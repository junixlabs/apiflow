# Go

Marker: `go.mod`. Identify the router from its require list: `gin-gonic/gin`,
`go-chi/chi`, `gorilla/mux`, `labstack/echo`, `gofiber/fiber`, or stdlib
`net/http`. A repo can use more than one — map the one serving the API.

Look for a `cmd/*/main.go` entrypoint; in a monorepo the API root is often
`backend/` or `backend-go/`.

## Routes (§3)

Follow the router value from where it is constructed to every registration.
Groups nest, so accumulate the prefix:

- **gin** — `r.GET/POST/...(path, handlers...)`; `r.Group("/v1")` returns a new
  router whose prefix stacks.
- **chi** — `r.Get/Post/...`; `r.Route("/users", func(r chi.Router){...})` nests;
  `r.Mount("/admin", sub)` grafts a whole sub-router.
- **mux** — `r.HandleFunc(path, h).Methods("GET")`. **The verb is on a chained
  call, not the registration** — a registration with no `.Methods(...)` accepts
  every verb; record that rather than guessing one.
- **echo** — `e.GET/POST/...`; `e.Group("/api")`.
- **fiber** — `app.Get/Post/...`; `app.Group("/api")`.
- **stdlib** — `mux.HandleFunc("/path", h)`. Go 1.22+ allows
  `"POST /users/{id}"` with the verb inside the pattern string; older code
  branches on `r.Method` inside the handler, so read the handler body.

Path parameter syntax differs per router (`:id`, `{id}`, `<id>`) — normalise all
of them to `{id}` for the `.apiview` URL.

Auth: a middleware in the chain or group whose name matches
`Auth|JWT|RequireUser|Protected`.

## Handlers (§4) and bodies (§5)

Request shape = the struct passed to `c.ShouldBindJSON(&x)`, `c.Bind(&x)`, or
`json.NewDecoder(r.Body).Decode(&x)`.

Read the struct definition and use the **`json` tag** as the field name, never
the Go field name. `json:"-"` means the field is not in the wire body.

Type → example: `string`→`"text"`, `int`/`int64`→`1`, `float64`→`1.5`,
`bool`→`true`, `time.Time`→ISO string, slice→`[]` with one element, pointer→the
underlying type, embedded struct→nested object.

`binding:"required"` marks required fields; include optional ones too.

## Grouping (§7)

One workflow per handler file or per route group, whichever is coarser.
