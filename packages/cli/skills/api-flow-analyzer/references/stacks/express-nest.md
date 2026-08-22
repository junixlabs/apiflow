# Express-family and NestJS

Markers: `express`, `fastify`, `koa`, `hono`, or `@nestjs/core` in `package.json`.

## Routes (§3) — Express / Fastify / Koa / Hono

Start at the entrypoint (`main`/`index`/`app`, or the `start` script) and follow
every `app.use(...)` and `router.use(...)` mount, **accumulating the path prefix
at each level**. A route's real path is the concatenation of its mounts, and
mounts are frequently in different files from the routes.

Bindings: `app.get/post/put/patch/delete(path, ...handlers)`, and the same on
any `Router()` instance. Hono and Fastify use the same verb shape.

Auth: a handler chain containing a middleware whose name matches
`auth|jwt|passport|requireUser|isAuthenticated|guard` is authenticated.

Inline arrow-function handlers are fine — trace them in place. Handlers resolved
from a variable set at runtime go to unresolved.

## Routes (§3) — NestJS

Path = `@Controller('prefix')` + the method decorator argument, plus any global
prefix set by `app.setGlobalPrefix(...)` in the bootstrap file, plus versioning
if `enableVersioning` is called. Check the bootstrap before trusting decorators
alone.

`@UseGuards(...)` on class or method = authenticated. `@Public()` (or the
project's equivalent) reverses it.

## Handlers (§4) and bodies (§5)

Request shape, in the order you should look:

- NestJS DTO with `class-validator` decorators → each decorator maps to a type
  (`@IsString`→`"text"`, `@IsInt`→`1`, `@IsBoolean`→`true`, `@IsEmail`→
  `"user@example.com"`, `@IsOptional` → include anyway).
- Zod / Yup / Joi schema referenced by a validation middleware or pipe →
  read the schema object.
- TypeScript type or interface on `req.body` → use the field types.
- Nothing typed → empty body, and a line in unresolved.

## Grouping (§7)

One workflow per router file (Express-family) or per controller class (Nest).
