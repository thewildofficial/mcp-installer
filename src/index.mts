#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnPromise } from "spawn-rx";
import * as yaml from 'js-yaml';

const server = new Server(
  {
    name: "mcp-installer",
    version: "0.5.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "install_repo_mcp_server",
        description: "Install an MCP server via npx or uvx",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "The package name of the MCP server",
            },
            args: {
              type: "array",
              items: { type: "string" },
              description: "The arguments to pass along",
            },
            env: {
              type: "array",
              items: { type: "string" },
              description: "The environment variables to set, delimited by =",
            },
          },
          required: ["name"],
        },
      },
      {
        name: "install_local_mcp_server",
        description:
          "Install an MCP server whose code is cloned locally on your computer",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description:
                "The path to the MCP server code cloned on your computer",
            },
            args: {
              type: "array",
              items: { type: "string" },
              description: "The arguments to pass along",
            },
            env: {
              type: "array",
              items: { type: "string" },
              description: "The environment variables to set, delimited by =",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "fix_installer_extension",
        description: "Fix the installer extension configuration in Goose",
        inputSchema: {
          type: "object",
          properties: {},
        },
      }
    ],
  };
});

async function hasNodeJs() {
  try {
    await spawnPromise("node", ["--version"]);
    return true;
  } catch (e) {
    return false;
  }
}

async function hasUvx() {
  try {
    await spawnPromise("uvx", ["--version"]);
    return true;
  } catch (e) {
    return false;
  }
}

async function isNpmPackage(name: string) {
  try {
    await spawnPromise("npm", ["view", name, "version"]);
    return true;
  } catch (e) {
    return false;
  }
}

function installToGooseExtensions(
 name: string,
  cmd: string,
  args: string[],
  env?: string[]
) {
  const configPath = process.env.HOME + "/.config/goose/config.yaml";

  // Read and parse existing YAML config
  let config: any;
  try {
    const configContent = fs.readFileSync(configPath, "utf8");
    config = yaml.load(configContent);
  } catch (e) {
    config = {};
  }

  // Initialize extensions if it doesn't exist
  if (!config.extensions) {
    config.extensions = {};
  }

  const envObj = (env ?? []).reduce((acc, val) => {
    const [key, value] = val.split("=");
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  // Add or update the extension entry
  config.extensions[name] = {
    name: name,
    cmd: cmd,
    args: args,
    enabled: true,
    type: "stdio",
    envs: Object.keys(envObj).length > 0 ? envObj : {}
  };

  // Write config back to file in YAML format
  fs.writeFileSync(configPath, yaml.dump(config, { lineWidth: 120 }));
}

function installRepoWithArgsToGoose(
  name: string,
  npmIfTrueElseUvx: boolean,
  args?: string[],
  env?: string[]
) {
  // If the name is in a scoped package, we need to remove the scope
  const serverName = /^@.*\//i.test(name) ? name.split("/")[1] : name;

  installToGooseExtensions(
    serverName,
    npmIfTrueElseUvx ? "npx" : "uvx",
    [name, ...(args ?? [])],
    env
  );
}

async function attemptNodeInstall(
  directory: string
): Promise<Record<string, string>> {
  await spawnPromise("npm", ["install"], { cwd: directory });

  // Run down package.json looking for bins
  const pkg = JSON.parse(
    fs.readFileSync(path.join(directory, "package.json"), "utf-8")
  );

  if (pkg.bin) {
    return Object.keys(pkg.bin).reduce((acc, key) => {
      acc[key] = path.resolve(directory, pkg.bin[key]);
      return acc;
    }, {} as Record<string, string>);
  }

  if (pkg.main) {
    return { [pkg.name]: path.resolve(directory, pkg.main) };
  }

  return {};
}

async function installLocalMcpServer(
  dirPath: string,
  args?: string[],
  env?: string[]
) {
  if (!fs.existsSync(dirPath)) {
    return {
      content: [
        {
          type: "text",
          text: `Path ${dirPath} does not exist locally!`,
        },
      ],
      isError: true,
    };
  }

  if (fs.existsSync(path.join(dirPath, "package.json"))) {
    const servers = await attemptNodeInstall(dirPath);

    Object.keys(servers).forEach((name) => {
      installToGooseExtensions(
        name,
        "node",
        [servers[name], ...(args ?? [])],
        env
      );
    });

    return {
      content: [
        {
          type: "text",
          text: `Installed the following servers to Goose extensions successfully! ${Object.keys(
            servers
          ).join(";")} Tell the user to restart the app`,
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text",
        text: `Can't figure out how to install ${dirPath}`,
      },
    ],
    isError: true,
  };
}

async function installRepoMcpServer(
  name: string,
  args?: string[],
  env?: string[]
) {
  if (!(await hasNodeJs())) {
    return {
      content: [
        {
          type: "text",
          text: `Node.js is not installed, please install it!`,
        },
      ],
      isError: true,
    };
  }

  if (await isNpmPackage(name)) {
    installRepoWithArgsToGoose(name, true, args, env);

    return {
      content: [
        {
          type: "text",
          text: "Installed MCP server to Goose extensions via npx successfully! Tell the user to restart the app",
        },
      ],
    };
  }

  if (!(await hasUvx())) {
    return {
      content: [
        {
          type: "text",
          text: `Python uv is not installed, please install it! Tell users to go to https://docs.astral.sh/uv`,
        },
      ],
      isError: true,
    };
  }

  installRepoWithArgsToGoose(name, false, args, env);

  return {
    content: [
      {
        type: "text",
        text: "Installed MCP server to Goose extensions via uvx successfully! Tell the user to restart the app",
      },
    ],
  };
}

async function fixInstallerExtension() {
  const configPath = process.env.HOME + "/.config/goose/config.yaml";
  
  // Read current config
  try {
    const configContent = fs.readFileSync(configPath, "utf8");
    const config = yaml.load(configContent) as any;
    
    if (config.extensions && config.extensions.installer) {
      // Fix the installer extension configuration
      config.extensions.installer = {
        name: "installer",
        cmd: "npx",
        args: ["@anaisbetts/mcp-installer"], // Use the correct package name
        enabled: true,
        envs: {},
        type: "stdio"
      };
      
      // Write updated config back
      fs.writeFileSync(configPath, yaml.dump(config));
      
      return {
        content: [
          {
            type: "text",
            text: "Successfully fixed installer extension configuration. Please restart Goose to apply changes."
          }
        ]
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: "Installer extension not found in config. Adding it now."
          }
        ]
      };
    }
  } catch (e) {
    return {
      content: [
        {
          type: "text",
          text: `Error fixing installer extension: ${e}`
        }
      ],
      isError: true
    };
  }
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    if (request.params.name === "install_repo_mcp_server") {
      const { name, args, env } = request.params.arguments as {
        name: string;
        args?: string[];
        env?: string[];
      };

      return await installRepoMcpServer(name, args, env);
    }

    if (request.params.name === "install_local_mcp_server") {
      const dirPath = request.params.arguments!.path as string;
      const { args, env } = request.params.arguments as {
        args?: string[];
        env?: string[];
      };

      return await installLocalMcpServer(dirPath, args, env);
    }
    
    if (request.params.name === "fix_installer_extension") {
      return await fixInstallerExtension();
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: `Error setting up package: ${err}`,
        },
      ],
      isError: true,
    };
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runServer().catch(console.error);
