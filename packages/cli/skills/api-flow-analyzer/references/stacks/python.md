# Python — FastAPI, Flask, Django REST

Marker: `fastapi`, `flask`, `django`, or `djangorestframework` in
`pyproject.toml` / `requirements*.txt`.

## Routes (§3)

**FastAPI** — `@app.get/post/...("/path")` and `@router.get(...)`. Prefixes come
from `app.include_router(router, prefix="/api/v1")`, which is usually in a
different file from the routes; resolve every `include_router` before writing
any path. `APIRouter(prefix=...)` stacks with it.

**Flask** — `@app.route("/path", methods=["GET","POST"])`. A `route` with no
`methods` is **GET only**. Blueprints add a prefix at
`app.register_blueprint(bp, url_prefix="/api")`.

**Django REST** — two sources: explicit `path()`/`re_path()` entries in
`urls.py`, and `router.register(r'users', UserViewSet)` which **generates** the
list/create/retrieve/update/destroy set. Enumerate the generated set; do not
emit one node per `register` call. `@action(detail=True, methods=['post'])` on a
ViewSet adds one extra route each.

Auth — FastAPI: a `Depends(...)` on a security dependency, or `dependencies=[...]`
on the router. Flask: a `@login_required`-style decorator. DRF:
`permission_classes` on the view, or the project-wide default in
`REST_FRAMEWORK` settings, which applies to views that declare nothing.

## Handlers (§4) and bodies (§5)

- **FastAPI** — the Pydantic model annotated on the body parameter. Field types
  map directly; `Field(...)` with a default means optional. A parameter typed
  `dict` or absent means no schema.
- **Flask** — usually `request.get_json()` with no schema. Look for marshmallow
  or Pydantic; if neither, empty body plus an unresolved line.
- **DRF** — the `serializer_class` on the view; read its fields, or its `Meta`
  `model` + `fields` when it is a `ModelSerializer`.

Type → example: `str`→`"text"`, `int`→`1`, `float`→`1.5`, `bool`→`true`,
`datetime`→ISO string, `List[X]`→`[X]`, `Optional[X]`→ include as `X`,
nested model→nested object.

## Grouping (§7)

One workflow per router module (FastAPI), blueprint (Flask), or ViewSet (DRF).
