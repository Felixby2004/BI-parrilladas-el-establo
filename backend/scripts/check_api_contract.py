"""Compara el contrato OpenAPI actual contra el baseline congelado.

Uso:
    python scripts/check_api_contract.py            # falla si el contrato cambió
    python scripts/check_api_contract.py --update   # regenera el baseline

El frontend depende de este contrato. Solo se permite un cambio: los campos
de identificador pasan de integer a string (UUID). Cualquier otro cambio
(renombrar, borrar, agregar, cambiar enum) falla el chequeo.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).resolve().parents[1]
BASELINE = BASE_DIR.parent / "docs" / "api" / "openapi.baseline.json"
sys.path.insert(0, str(BASE_DIR))

HTTP_METHODS = ("get", "post", "put", "patch", "delete")
ID_PREFIXES = ("id_", "id")


def _current_spec() -> dict[str, Any]:
    from app.main import app

    return app.openapi()


def _is_id_field(name: str) -> bool:
    return name == "id" or name.startswith("id_")


def _type_of(schema: dict[str, Any]) -> str:
    """Tipo legible de un schema, resolviendo anyOf/oneOf y $ref de un nivel."""
    if not isinstance(schema, dict):
        return "unknown"
    if "$ref" in schema:
        return schema["$ref"].rsplit("/", 1)[-1]
    for key in ("anyOf", "oneOf", "allOf"):
        options = schema.get(key)
        if isinstance(options, list):
            types = [_type_of(o) for o in options if _type_of(o) != "null"]
            if types:
                return types[0] if len(types) == 1 else "|".join(sorted(set(types)))
    if schema.get("type") == "array":
        return f"array<{_type_of(schema.get('items', {}))}>"
    if schema.get("type") == "null":
        return "null"
    return str(schema.get("type", "unknown"))


def _flatten(spec: dict[str, Any], schema: dict[str, Any], prefix: str = "", depth: int = 0) -> dict[str, str]:
    """Aplana un schema a {campo.anidado: tipo}. Los $ref se resuelven."""
    out: dict[str, str] = {}
    if depth > 4 or not isinstance(schema, dict):
        return out
    if "$ref" in schema:
        name = schema["$ref"].rsplit("/", 1)[-1]
        target = spec.get("components", {}).get("schemas", {}).get(name, {})
        return _flatten(spec, target, prefix, depth + 1)
    for key in ("anyOf", "oneOf", "allOf"):
        if isinstance(schema.get(key), list):
            for option in schema[key]:
                out.update(_flatten(spec, option, prefix, depth + 1))
            return out
    if schema.get("type") == "array":
        return _flatten(spec, schema.get("items", {}), prefix, depth + 1)
    properties = schema.get("properties")
    if isinstance(properties, dict):
        for name, sub in properties.items():
            path = f"{prefix}.{name}" if prefix else name
            out[path] = _type_of(sub)
            nested = _flatten(spec, sub, path, depth + 1)
            for key, value in nested.items():
                out.setdefault(key, value)
    return out


def _operation_contract(spec: dict[str, Any], path: str, method: str) -> dict[str, Any]:
    op = spec["paths"][path][method]
    body = (
        op.get("requestBody", {})
        .get("content", {})
        .get("application/json", {})
        .get("schema", {})
    )
    responses = {}
    for code, response in op.get("responses", {}).items():
        schema = (
            response.get("content", {})
            .get("application/json", {})
            .get("schema", {})
        )
        responses[code] = _flatten(spec, schema) if schema else {}
    params = {
        f"{p.get('in')}:{p.get('name')}": _type_of(p.get("schema", {}))
        for p in op.get("parameters", [])
    }
    return {
        "params": params,
        "body": _flatten(spec, body) if body else {},
        "responses": responses,
    }


def _diff(label: str, old: dict[str, Any], new: dict[str, Any], errors: list[str]) -> None:
    for key in sorted(set(old) | set(new)):
        if key not in new:
            errors.append(f"{label}: campo eliminado '{key}' (era {old[key]})")
            continue
        if key not in old:
            errors.append(f"{label}: campo nuevo '{key}' ({new[key]})")
            continue
        if old[key] == new[key]:
            continue
        leaf = key.rsplit(":", 1)[-1].rsplit(".", 1)[-1]
        id_change = (
            _is_id_field(leaf)
            and old[key] in ("integer", "number")
            and new[key] == "string"
        )
        if not id_change:
            errors.append(f"{label}: '{key}' cambió {old[key]} -> {new[key]}")


def compare(old_spec: dict[str, Any], new_spec: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    old_ops = {(p, m) for p, ops in old_spec["paths"].items() for m in ops if m in HTTP_METHODS}
    new_ops = {(p, m) for p, ops in new_spec["paths"].items() for m in ops if m in HTTP_METHODS}

    for path, method in sorted(old_ops - new_ops):
        errors.append(f"endpoint eliminado: {method.upper()} {path}")
    for path, method in sorted(new_ops - old_ops):
        errors.append(f"endpoint nuevo: {method.upper()} {path}")

    for path, method in sorted(old_ops & new_ops):
        label = f"{method.upper()} {path}"
        old = _operation_contract(old_spec, path, method)
        new = _operation_contract(new_spec, path, method)
        _diff(f"{label} params", old["params"], new["params"], errors)
        _diff(f"{label} body", old["body"], new["body"], errors)
        for code in sorted(set(old["responses"]) | set(new["responses"])):
            if code not in new["responses"]:
                errors.append(f"{label}: respuesta {code} eliminada")
                continue
            if code not in old["responses"]:
                errors.append(f"{label}: respuesta {code} nueva")
                continue
            _diff(f"{label} {code}", old["responses"][code], new["responses"][code], errors)

    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--update", action="store_true", help="regenera el baseline")
    args = parser.parse_args()

    spec = _current_spec()
    if args.update:
        BASELINE.parent.mkdir(parents=True, exist_ok=True)
        BASELINE.write_text(
            json.dumps(spec, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8"
        )
        print(f"baseline actualizado: {BASELINE}")
        return 0

    if not BASELINE.exists():
        print(f"Falta el baseline: {BASELINE}", file=sys.stderr)
        return 2

    baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
    errors = compare(baseline, spec)
    if errors:
        print(f"CONTRATO ROTO ({len(errors)} diferencias):", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1

    print("Contrato API sin cambios fuera de IDs UUID.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
