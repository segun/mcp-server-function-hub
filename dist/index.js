#!/usr/bin/env node
import dotenv from "dotenv";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
dotenv.config();
export const getEnvVars = () => {
    const API_KEY = process.env.API_KEY || "";
    if (!API_KEY) {
        console.error("API_KEY environment variable is not set");
        process.exit(1);
    }
    return API_KEY;
};
const API_KEY = getEnvVars();
// const FUNCTION_HUB_URL = "https://fh-master.onrender.com";
const FUNCTION_HUB_URL = "http://localhost:3001";
export const getAllTools = async () => {
    // go to test tools
    const getToolsResponse = await fetch(`${FUNCTION_HUB_URL}/api/test-tools`, {
        headers: {
            "Content-Type": "application/json",
            "x-api-key": API_KEY,
        },
    });
    if (getToolsResponse.ok) {
        const tools = (await getToolsResponse.json());
        return tools;
    }
    else {
        console.error("Failed to get tools");
        return [];
    }
};
// Create an MCP server
const server = new Server({
    name: "mcp-server-function-hub",
    version: "0.0.1",
}, {
    capabilities: {
        tools: {
            listChanged: true,
        },
    },
});
const PAGE_SIZE = 10;
// Set up request handlers
server.setRequestHandler(ListToolsRequestSchema, async (request) => {
    const cursor = request.params?.cursor;
    let startIndex = 0;
    if (cursor) {
        const decodedCursor = parseInt(atob(cursor), 10);
        if (!isNaN(decodedCursor)) {
            startIndex = decodedCursor;
        }
    }
    const ALL_TOOLS = await getAllTools();
    const endIndex = Math.min(startIndex + PAGE_SIZE, ALL_TOOLS.length);
    let nextCursor;
    if (endIndex < ALL_TOOLS.length) {
        nextCursor = btoa(endIndex.toString());
    }
    return {
        tools: ALL_TOOLS.slice(startIndex, endIndex),
        nextCursor: nextCursor,
    };
});
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
        const toolResponse = await fetch(`${FUNCTION_HUB_URL}/api/run-tool`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": API_KEY,
            },
            body: JSON.stringify({
                method: request.params.name,
                params: request.params.arguments,
            }),
        });
        if (toolResponse.ok) {
            const toolResponseJson = await toolResponse.json();
            return toolResponse
                ? {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(toolResponseJson, null, 2),
                        },
                    ],
                    isError: false,
                }
                : {
                    content: [
                        {
                            type: "text",
                            text: "No response from tool",
                        },
                    ],
                    isError: true,
                };
        }
        else {
            return {
                content: [
                    {
                        type: "text",
                        text: `Unknown tool: ${request.params.name}`,
                    },
                ],
                isError: true,
            };
        }
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
            isError: true,
        };
    }
});
const runServer = async () => {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Function Hub MCP Server running on stdio");
};
runServer().catch((error) => {
    console.error("Fatal error running server:", error);
    process.exit(1);
});
