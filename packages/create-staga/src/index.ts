#!/usr/bin/env node

import program from 'animaux';
import { version } from '../package.json';

const app = program({ name: 'create-staga' }).version(version);

app.action(() => {});
