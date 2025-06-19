import { Hono } from "hono";
import { githubAuth } from "@hono/oauth-providers/github";

const github = new Hono()

github.use(
  '/',
  githubAuth({
    client_id: "XXXXXXXXXXX",
    client_secret: "XXXXXXXXXXXXXX",
    scope: ['user'],
    oauthApp: true,
  })
)

github.get('/', (c) => {
  const token = c.get('token');
  const user = c.get('user-github');
  console.log(user)
  return c.json({ token, user });
})

export default github