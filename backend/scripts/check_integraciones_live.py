"""Smoke HTTP de servidores ya iniciados; sin crear contactos, fotos ni cobros."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import httpx
from app.core.config import settings


def main():
    api = "http://127.0.0.1:8000"
    web = "http://127.0.0.1:5173"
    with httpx.Client(timeout=20, follow_redirects=True, trust_env=False) as client:
        for url in (api + "/health", api + "/docs", web + "/buyers", web + "/leads", web + "/api/v1/leads"):
            response = client.get(url)
            assert response.status_code == 200, (url, response.status_code)
        spec = client.get(api + "/openapi.json").json()
        assert "/api/v1/integraciones/hermes/mensajes" in spec["paths"]
        assert "/api/v1/creativos/generar" in spec["paths"]
        for base in (api, web):
            config = client.get(base + "/api/v1/creativos/configuracion")
            assert config.status_code == 200
            assert config.json()["formatos"] == ["9:16", "4:5"]
            assert "imagen_base64" not in config.text
            if not config.json()["configurado"]:
                result = client.post(base + "/api/v1/creativos/generar", json={"prompt": "Prueba local sin generar fotografías", "formato": "9:16"})
                assert result.status_code == 503, result.text
            route = base + "/api/v1/integraciones/hermes/mensajes"
            invalid = {"message_id": "smoke-no-write", "mensaje": ""}
            unauthorized = client.post(route, json=invalid)
            assert unauthorized.status_code == 401, (base, unauthorized.status_code)
            assert settings.HERMES_WEBHOOK_TOKEN
            authorized = client.post(route, json=invalid, headers={"Authorization": f"Bearer {settings.HERMES_WEBHOOK_TOKEN}"})
            assert authorized.status_code == 422, (base, authorized.status_code)
            assert settings.HERMES_WEBHOOK_TOKEN not in authorized.text
        leads = client.get(api + "/api/v1/leads", params={"limit": 1}).json()
        if leads:
            assert "buyer_canal" in leads[0]
        # El dev server también transforma las dos pantallas sin errores.
        for module in ("/src/pages/buyers/DashboardMarketing.tsx", "/src/pages/leads/LeadsPage.tsx"):
            response = client.get(web + module)
            assert response.status_code == 200, (module, response.status_code)
    print("OK: servidores, rutas Buyers/Leads, configuración Google, Bearer Hermes y proxy; ninguna escritura ni llamada Google real")


if __name__ == "__main__":
    main()
