import httpx
import os
import json
import secrets
import logging
from typing import Optional, Tuple

logger = logging.getLogger("deployx.cloudflare")


class CloudflareService:
    """Service for interacting with the Cloudflare API to manage tunnels and DNS."""

    def __init__(self, api_token: str):
        self.api_token = api_token
        self.base_url = "https://api.cloudflare.com/client/v4"
        self.headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json",
        }

    # ------------------------------------------------------------------
    #  Zone helpers
    # ------------------------------------------------------------------
    async def get_zone_id(self, domain: str) -> Optional[str]:
        """Return the zone ID for *domain*, or None."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{self.base_url}/zones",
                headers=self.headers,
                params={"name": domain},
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("success") and data.get("result"):
                    return data["result"][0]["id"]
        return None

    async def get_account_id(self) -> Optional[str]:
        """Resolve the account ID from zones list."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(f"{self.base_url}/zones", headers=self.headers)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("success") and data.get("result"):
                    return data["result"][0]["account"]["id"]
        return None

    # ------------------------------------------------------------------
    #  Tunnel CRUD
    # ------------------------------------------------------------------
    async def create_tunnel(self, name: str, zone_id: str) -> Tuple[str, str]:
        """Create a Cloudflare Tunnel and return *(tunnel_id, tunnel_token)*."""
        account_id = await self.get_account_id()
        if not account_id:
            raise Exception("Unable to resolve Cloudflare account ID")

        async with httpx.AsyncClient(timeout=30) as client:
            tunnel_data = {"name": name, "tunnel_secret": secrets.token_urlsafe(32)}
            resp = await client.post(
                f"{self.base_url}/accounts/{account_id}/cfd_tunnel",
                headers=self.headers,
                json=tunnel_data,
            )
            if resp.status_code not in (200, 201):
                raise Exception(f"Tunnel creation failed: {resp.text}")

            result = resp.json()
            if not result.get("success"):
                raise Exception(f"Tunnel creation unsuccessful: {result}")

            tunnel_id = result["result"]["id"]
            tunnel_token = await self._get_tunnel_token(account_id, tunnel_id)
            return tunnel_id, tunnel_token

    async def create_dns_record(self, zone_id: str, subdomain: str, tunnel_id: str) -> bool:
        """Create a proxied CNAME record pointing *subdomain* to the tunnel."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self.base_url}/zones/{zone_id}/dns_records",
                headers=self.headers,
                json={
                    "type": "CNAME",
                    "name": subdomain,
                    "content": f"{tunnel_id}.cfargotunnel.com",
                    "ttl": 1,
                    "proxied": True,
                },
            )
            if resp.status_code == 200:
                return resp.json().get("success", False)
            return False

    async def configure_tunnel_routing(self, account_id: str, tunnel_id: str, hostname: str) -> bool:
        """Set the tunnel ingress rules to route traffic to Traefik."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.put(
                f"{self.base_url}/accounts/{account_id}/cfd_tunnel/{tunnel_id}/configurations",
                headers=self.headers,
                json={
                    "config": {
                        "ingress": [
                            {"hostname": hostname, "service": "http://traefik:80"},
                            {"service": "http_status:404"},
                        ]
                    }
                },
            )
            return resp.status_code == 200

    async def delete_tunnel(self, tunnel_id: str) -> bool:
        """Delete an existing Cloudflare tunnel."""
        account_id = await self.get_account_id()
        if not account_id:
            return False
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.delete(
                f"{self.base_url}/accounts/{account_id}/cfd_tunnel/{tunnel_id}",
                headers=self.headers,
            )
            return resp.status_code == 200

    # ------------------------------------------------------------------
    #  Internal helpers
    # ------------------------------------------------------------------
    async def _get_tunnel_token(self, account_id: str, tunnel_id: str) -> str:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{self.base_url}/accounts/{account_id}/cfd_tunnel/{tunnel_id}/token",
                headers=self.headers,
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("success"):
                    return data["result"]
        return tunnel_id  # fallback

    async def update_env_file(self, tunnel_token: str):
        """Persist the tunnel token into the project .env file."""
        env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
        env_vars: dict[str, str] = {}
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        env_vars[k] = v
        env_vars["TUNNEL_TOKEN"] = tunnel_token
        with open(env_path, "w") as f:
            for k, v in env_vars.items():
                f.write(f"{k}={v}\n")
        logger.info("Tunnel token written to %s", env_path)
