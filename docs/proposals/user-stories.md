# API View — User Stories

## Epic 1: Flow Canvas Management

### US-1.1: Create a new flow

**As a** backend developer
**I want to** create an empty flow on the canvas
**So that** I can start designing the API chain for the feature I am building

**Acceptance Criteria:**
- Open the app → an empty canvas is ready to use
- The flow can be given a name
- The canvas supports zoom in/out and pan (drag to move)

---

### US-1.2: Add an API node to the canvas

**As a** backend developer
**I want to** drag or click to add an API node to the canvas
**So that** one node stands for one API endpoint in the flow

**Acceptance Criteria:**
- A new node is added by double-clicking the canvas or by the "Add Node" button
- Each node shows: the HTTP method (GET/POST/PUT/DELETE/PATCH), the URL, and a custom name
- Nodes are colour-coded by HTTP method
- A node can be moved freely on the canvas

---

### US-1.3: Configure an API node

**As a** backend developer
**I want to** configure each API node in detail (URL, method, headers, body, query params)
**So that** the node makes the right API call when it runs

**Acceptance Criteria:**
- Click a node → the configuration panel opens on the right
- The configuration covers:
  - HTTP method (dropdown)
  - URL (text input, with variable placeholders such as `{{base_url}}`)
  - Headers (key-value editor)
  - Query parameters (key-value editor)
  - Request body (JSON editor with syntax highlighting)
  - Authentication (Bearer token, Basic auth, or a custom header)
- Changes are saved automatically when the panel loses focus

---

### US-1.4: Connect nodes

**As a** backend developer
**I want to** drag a connection from node A to node B
**So that** I define the execution order: A runs first, B runs after

**Acceptance Criteria:**
- Drag from the output port (right of a node) to the input port (left of a node) to create a connection
- The line carries an arrow showing the direction of execution
- One node can connect to several following nodes (parallel execution)
- One node can take input from several preceding nodes (wait-all or wait-any)
- A connection can be deleted by clicking the line and pressing Delete

---

### US-1.5: Delete a node or a connection

**As a** backend developer
**I want to** remove a node or a connection from the canvas
**So that** I can adjust the flow when I get the design wrong

**Acceptance Criteria:**
- Select a node → press Delete or Backspace to remove it
- Deleting a node also deletes every connection attached to it
- Undo (Ctrl+Z) works after a delete

---

## Epic 2: Flow Execution & Inspection

### US-2.1: Run the whole flow

**As a** backend developer
**I want to** press "Run" to execute the whole flow in the order I connected it
**So that** I see the result of every API in the chain

**Acceptance Criteria:**
- Press "Run" → the flow executes in topological order (nodes with no dependency run first)
- While running, the executing node has a visual indicator (loading spinner, highlighted border)
- A successful node → green border; a failed node → red border
- After the run, each node shows its status code and response time
- The flow stops when a node fails (with an option to continue anyway)

---

### US-2.2: Run a single node

**As a** backend developer
**I want to** right-click a node and choose "Run this node"
**So that** I can test one specific API without running the whole flow

**Acceptance Criteria:**
- Right-click a node → context menu → "Run This Node"
- The node runs on its own, using its current configuration
- The result appears immediately in the inspection panel

---

### US-2.3: Inspect a response in detail

**As a** backend developer
**I want to** click a node that has finished running to see its request/response in detail
**So that** I know exactly the data shape, the field names, and the values returned

**Acceptance Criteria:**
- Click a node that has run → the panel shows:
  - **Request tab:** method, URL (resolved), headers, the body that was sent
  - **Response tab:** status code, headers, body (JSON formatted + syntax highlighted)
  - **Timing tab:** duration, size
- The JSON response can be collapsed/expanded level by level
- The response, or a single field, can be copied
- There is search/filter inside the JSON response

---

### US-2.4: See the data flow between nodes

**As a** backend developer
**I want to** see clearly which data from an earlier node is used by a later one
**So that** I understand how data is collected and linked across the APIs

**Acceptance Criteria:**
- Hovering a connection line → a tooltip shows the data being passed
- In node B's configuration, node A's output can be referenced with the syntax `{{nodes["Get Product"].response.body.id}}`
- When inspecting, both the raw value (before resolution) and the resolved value are shown
- A visual highlight on the canvas when a field is referenced by another node

---

## Epic 3: Environment & Variables

### US-3.1: Manage environment variables

**As a** backend developer
**I want to** define environment variables (base_url, api_key, token)
**So that** I can switch between local/staging/production without editing every node

**Acceptance Criteria:**
- An environment panel manages key-value pairs
- Several environments are supported (Local, Staging, Production)
- The environment is switched from a dropdown
- In a node configuration, `{{base_url}}` references a variable
- Sensitive values (token, api_key) are masked (***) and revealed on click

---

### US-3.2: Dynamic variables from a response

**As a** backend developer
**I want to** use a value from an earlier node's response as input to a later node
**So that** I can chain API calls with real data (for example: take product_id from API 1 to call API 2)

**Acceptance Criteria:**
- Syntax: `{{nodes["Node Name"].response.body.path.to.field}}`
- Autocomplete when typing `{{` → lists the available nodes and fields
- If the earlier node has not run, a warning is shown
- Nested objects and arrays are reachable: `{{nodes["Get Products"].response.body.data[0].id}}`

---

## Epic 4: Flow Persistence

### US-4.1: Save a flow to a file

**As a** backend developer
**I want to** save the current flow as a JSON file
**So that** I can reopen it later, or commit it to the repo alongside the source code

**Acceptance Criteria:**
- Ctrl+S or the Save button → writes an `.apiview` file (JSON format)
- The file contains: nodes, connections, positions, configurations, environments
- The default file name follows the flow name
- The target directory can be chosen

---

### US-4.2: Open a saved flow

**As a** backend developer
**I want to** open a flow file I saved earlier
**So that** I can come back to the flow when I need to debug or review it

**Acceptance Criteria:**
- Ctrl+O or the Open button → a file picker for an `.apiview` file
- The flow is restored with the right node positions, connections and configuration
- If the file is corrupt, a clear error message is shown

---

### US-4.3: Flow library

**As a** backend developer
**I want to** see every saved flow when I open the app
**So that** I can pick the flow I need without hunting for a file

**Acceptance Criteria:**
- A sidebar or home screen lists the saved flows
- Each flow shows: name, a short description, the node count, and the last-modified date
- Flows can be searched by name
- A flow can be removed from the library

---

## Epic 5: Documentation & Export

### US-5.1: Export the flow as an image

**As a** backend developer
**I want to** export the canvas as PNG/SVG
**So that** I can drop it into a document, a wiki, or send it to the team

**Acceptance Criteria:**
- An Export button → choose PNG or SVG
- The image contains every node and connection on the canvas
- A white background (for documents) or a transparent one (for a wiki)

---

### US-5.2: Notes on a node

**As a** backend developer
**I want to** add a note/description to each node
**So that** I can record why this API sits at this point in the flow, or any special caveat

**Acceptance Criteria:**
- Every node has a "Description" field in the configuration panel
- The description appears as a tooltip when the node is hovered
- Basic markdown is supported (bold, italic, lists)

---

### US-5.3: Annotations on the canvas

**As a** backend developer
**I want to** add free text annotations on the canvas
**So that** I can group nodes and note what each group is for

**Acceptance Criteria:**
- A free text box can be placed anywhere on the canvas
- Its font size and colour can be changed
- A text box has no effect on flow execution
- Nodes can be grouped into a frame/box with a label

---

## Epic 6: Developer Experience

### US-6.1: Keyboard shortcuts

**As a** backend developer
**I want to** use keyboard shortcuts for the things I do often
**So that** I work faster without reaching for the mouse

**Acceptance Criteria:**
- `Ctrl+S` — save the flow
- `Ctrl+O` — open a flow
- `Ctrl+Enter` — run the flow
- `Delete/Backspace` — delete the selected node/connection
- `Ctrl+Z` — undo
- `Ctrl+Shift+Z` — redo
- `Ctrl+D` — duplicate a node
- `Space + Drag` — pan the canvas
- `Ctrl + Scroll` — zoom

---

### US-6.2: Import from cURL

**As a** backend developer
**I want to** paste a cURL command to create a node automatically
**So that** I do not retype API details I already have from browser DevTools or documentation

**Acceptance Criteria:**
- An "Import cURL" button, or pasting cURL onto the canvas
- Parsed automatically: method, URL, headers, body, query params
- A new node is created with the configuration filled in
- The common cURL forms are supported (with -H, -d, -X flags)

---

### US-6.3: Import from OpenAPI/Swagger

**As a** backend developer
**I want to** import an OpenAPI spec file to get a list of available endpoints
**So that** I drag an endpoint onto the canvas instead of typing it by hand

**Acceptance Criteria:**
- Import a `.yaml` or `.json` OpenAPI spec
- A sidebar lists the endpoints grouped by tag
- Dragging an endpoint from the sidebar onto the canvas → creates a node with the method, URL and an example body
- It can be refreshed when the spec changes
