#!/usr/bin/env node
import {serveStdio} from '@modelcontextprotocol/server/stdio';
import {createInkubatorServerClientFromEnv} from '@rekt-ink/sdk/server';
import {createInkubatorMcpServer} from './index.js';
void serveStdio(() => createInkubatorMcpServer({client:createInkubatorServerClientFromEnv()}));
