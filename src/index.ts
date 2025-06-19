import { serve } from '@hono/node-server'
import { Hono } from 'hono'

import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import hello from './router/hello.js'
import github from './router/github.js'

const app = new Hono()

app.use(logger(), cors());

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.route('/api', hello)
app.route('/github', github)

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
});