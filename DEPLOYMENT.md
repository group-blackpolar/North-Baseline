# NORTH production host

The web build is live at `https://north.blackpolar.org` and calls CoreCrow at `https://api.blackpolar.org`. The repository includes a verified GitHub Actions deployment, an atomic static release script, and the nginx virtual host in `deploy/nginx.conf`.

Production infrastructure already has the required DNS record, TLS certificate, nginx virtual host, and CoreCrow trusted origin. The deploy workflow is manual. Before running it, configure these repository secrets:

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`

No DNS or certificate credentials belong in NORTH. The workflow deliberately fails its final public reachability check rather than claiming a successful release when the host does not serve the expected NORTH build.
