#!/usr/bin/env node

import dotenv from "dotenv";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
dotenv.config();

export const getEnvVars = (): string => {
  const API_KEY = process.env.API_KEY || "";

  if (!API_KEY) {
    console.error("API_KEY environment variable is not set");
    process.exit(1);
  }

  return API_KEY;
};

const API_KEY = getEnvVars();
// const FUNCTION_HUB_URL = "https://fh-master.onrender.com";
const FUNCTION_HUB_URL = "http://localhost:3000";

export const getAllTools = async (): Promise<Tool[]> => {
  // go to test tools
  const getToolsResponse = await fetch(`${FUNCTION_HUB_URL}/api/test-tools`, {
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
  });

  if (getToolsResponse.ok) {
    const tools = (await getToolsResponse.json()) as Tool[];
    return tools;
  } else {
    console.error("Failed to get tools");
    return [];
  }
};

// Create an MCP server
const server = new Server(
  {
    name: "mcp-server-function-hub",
    version: "0.0.1",
  },
  {
    capabilities: {
      tools: {
        listChanged: true,
      },
    },
  }
);

// Set up request handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const allTools = await getAllTools();
  return {
    tools: allTools,
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    return {
      content: [
        {
          type: "text",
          text: `Unknown tool: ${request.params.name}`,
        },
      ],
      isError: true,
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      isError: true,
    };
  }
});

const runServer = async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Google Maps MCP Server running on stdio");
};

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
