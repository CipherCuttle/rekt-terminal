import assert from 'node:assert/strict';
import test from 'node:test';
import {MCP_RESOURCE_URIS,MCP_TOOL_NAMES} from '../dist/index.js';
test('SDK-H08 MCP discovery surface contains no operator/proof authority',()=>{assert.equal(MCP_RESOURCE_URIS.length,5);assert.equal(MCP_TOOL_NAMES.length,11);const surface=[...MCP_RESOURCE_URIS,...MCP_TOOL_NAMES].join(' ');assert.doesNotMatch(surface,/prove|proven|grant.*achievement|approve.*ship|moderate|round.*admin|operator/i);});
