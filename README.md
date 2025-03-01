# mcp-installer - A MCP Server to install MCP Servers for Goose

This server is a fork of the original [@anaisbetts/mcp-installer](https://github.com/anaisbetts/mcp-installer) adapted specifically for the Codename Goose client. It helps you install other MCP servers directly through Goose's interface. This version has been modified to work with Goose's YAML configuration format and extension system.

## Changes from original
- Works with Goose's YAML configuration format instead of Claude Desktop JSON
- Uses the Goose extensions system for registering MCP servers
- Adds a tool to fix common installation issues
- Maintains the existing configuration structure when adding new extensions

## Installation Requirements
- Node.js installed (for npm/npx)
- Python uv installed (for uvx, optional, only needed for Python-based MCP servers)
- Access to the local filesystem where Goose's configuration is stored

## Installation Steps

1. Clone this repository locally:
```bash
git clone https://github.com/thewildofficial/mcp-installer.git
cd mcp-installer
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run prepare
```

4. Configure Goose to use the local installation:
   
Add the following entry to your `~/.config/goose/config.yaml`:

```yaml
extensions:
  installer:
    name: installer
    cmd: npx
    args:
      - /path/to/cloned/mcp-installer/src/index.mts
    enabled: true
    type: stdio
    envs: {}
```

Replace `/path/to/cloned/mcp-installer` with the actual path where you cloned the repository.

5. Restart Goose for the changes to take effect

### Example prompts

> Hey Goose, install the MCP server named mcp-server-fetch

> Hey Goose, install the @modelcontextprotocol/server-filesystem package as an MCP server. Use ['/Users/username/Desktop'] for the arguments

> Hi Goose, please install the MCP server at /Users/username/code/mcp-youtube

> Install the server @modelcontextprotocol/server-github. Set the environment variable GITHUB_PERSONAL_ACCESS_TOKEN to '1234567890'

> Fix the installer extension configuration

## Troubleshooting

If you get errors about the installer extension failing to start, try asking Goose to "Fix the installer extension configuration" - this will attempt to correct common configuration issues.

## Publishing Your Fork

If you've made changes to this repository that you want to publish:

1. Create a new repository on GitHub:
   - Go to https://github.com/new
   - Name your repository (e.g., "mcp-installer" or "goose-mcp-installer")
   - Add a description
   - Choose public or private visibility
   - Click "Create repository"

2. Push your local repository to GitHub:
```bash
# Navigate to your local repository
cd /path/to/mcp-installer

# Set the new repository as the origin (replace USERNAME with your GitHub username)
git remote set-url origin https://github.com/USERNAME/REPOSITORY_NAME.git
# Or if you're adding it as a new remote:
# git remote add origin https://github.com/USERNAME/REPOSITORY_NAME.git

# Push your changes to GitHub
git push -u origin main
```

3. Update package.json with your information:
   - Change the name, version, repository URL, and author fields
   - Run `npm install` to update package-lock.json

4. If you want to publish to npm:
```bash
# Login to npm
npm login

# Publish the package
npm publish
```

Note: If you're publishing under the same name as the original package, you'll need to use a scope (e.g., @yourusername/mcp-installer) or a completely different name.
