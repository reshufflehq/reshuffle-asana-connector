# reshuffle-asana-connector

[Code](https://github.com/reshufflehq/reshuffle-asana-connector) |  [npm](https://www.npmjs.com/package/reshuffle-asana-connector) | [Code sample](https://github.com/reshufflehq/reshuffle/tree/master/examples/asana)

`npm install reshuffle-asana-connector`

This connector uses [Node Asana Client](https://github.com/Asana/node-asana) package.

### Reshuffle Asana Connector

This package contains a [Reshuffle](https://github.com/reshufflehq/reshuffle) connector for [Asana](https://app.asana.com/).

The following example listen to Asana updates:
```js
const { Reshuffle } = require('reshuffle')
const { AsanaConnector } = require('reshuffle-asana-connector')

const app = new Reshuffle()

const connector = new AsanaConnector(app, {
  accessToken: process.env.ASANA_ACCESS_TOKEN,
  baseURL: process.env.RUNTIME_BASE_URL,
  workspaceId: process.env.ASANA_WORKSPACE_ID,
})

// Listening to any changes for a given project
connector.on({ gid: projectId, asanaEvent: 'changed' }, (event, app) => {
  console.log(event.change) // { field: 'likes', action: 'added', added_value: { gid: '1199236509904757', resource_type: 'like', user: {...} } }
})

app.start()
```

### Table of Contents

[Create Asana API token](#apitoken)

[Configuration Options](#configuration)

#### Connector Events

[Listening to Asana events](#listen)

#### Connector Actions
[SDK](#sdk) - Node Asana Client SDK

[Examples using the SDK](#sdk)

#### <a name="apitoken"></a>Create Asana access token
Create Asana access token:
- Go to https://app.asana.com/0/developer-console
- Under 'Personal Access Token'' > '+ New Access Token'
- Name it, copy your token, and pass it to the connector as below

#### <a name="configuration"></a>Configuration Options

```typescript
const connector = new AsanaConnector(app, {
  accessToken: process.env.ASANA_ACCESS_TOKEN,
})
``` 

To use Reshuffle Asana connector events, you need to provide at least your runtime baseURL and workspaceId.
The workspaceId can be find in Asana Console page url (e.g. https://app.asana.com/admin/<YOUR_WORKSPACE_ID>) 
You can also override the default webhookPath.
```typescript
const connector = new AsanaConnector(app, {
  accessToken: process.env.ASANA_ACCESS_TOKEN,
  baseURL: process.env.RUNTIME_BASE_URL,
  workspaceId: process.env.ASANA_WORKSPACE_ID,
  webhookPath: process.env.ASANA_WEBHOOK_PATH // Optional, default is '/reshuffle-asana-connector/webhook'
})
```

Required webhooks will be automatically set up for you on app.start().
It uses existing webhooks when ti finds one already registered with the same base URL / workspace ID.

#### Connector events

##### <a name="listen"></a>Listening to Asana events

*Note: Reshuffle Asana events uses Asana webhooks which can be triggered up to a minute after the actual event took place in asana.com*

To listen to events happening in Asana, simply pass the gid of the entity you want to track (project or task id)
This can be found in the URL (e.g for your project home page: https://app.asana.com/0/<YOUR_PROJECT_ID>/board)
You can also pass an asanaEvent (default is trigger for any changes)
```typescript
interface AsanaConnectorEventOptions {
  gid: string // Asana project or task unique identifier
  asanaEvent?: AsanaEvent // Optional, the default is to listen to any Asana events 
}

// List extracted from section 'Resources and Actions' at https://developers.asana.com/docs/webhooks
type AsanaEvent = '*' | 'deleted' | 'undeleted' | 'added' | 'removed' | 'changed'
```

- Listening to all events in your project
```typescript
connector.on({ gid: projectId }, (event, app) => {
  console.log(event.change) // type is AsanaEvent, e.g. 'changed'
})
```

- Listening to added entities in your project
```typescript
connector.on({ gid: projectId, asanaEvent: 'added' }, async (event, app) => {
  console.log(event.change) // e.g. 'added'
  console.log(event.resource) // { gid: '1198840429184158', resource_type: 'story', resource_subtype: 'added_to_project' }

  // Get the new task details
  const newTask = await connector.sdk().tasks.findById(event.resource.gid)
  console.log('new task details', newTask) // { gid: '1199238260452125', created_at: '2020-11-20T01:13:37.669Z', name: 'task name', ... }
})
```

#### Connector actions

All actions are provided via the sdk.
See full list of actions with documentation in [Node Asana Client code](https://github.com/Asana/node-asana/tree/master/lib/resources) (select a resource and see the list of actions available via the sdk action.)


##### <a name="sdk"></a>SDK

Full access to the Node Asana Client SDK

```typescript
const sdk = await connector.sdk()
```

##### <a name="examples"></a>Examples using the SDK

- Get project details
```typescript
const project = await connector.sdk().projects.findById(projectId)
console.log('project details', project) // { name: 'my project name', ... }
```

- Create a new task:
```typescript
const task = await connector.sdk().tasks.createInWorkspace(project.workspace.gid, { name: 'task 1' })
console.log(`task created`, task) // { gid: '1234567898765', name: 'task 1' }
```

- Get all tasks for a project
```typescript
const tasks = await connector.sdk().tasks.findByProject(projectId)
console.log(`tasks for project ${projectId}`, tasks.data) // [{ gid: '1199204075353966', name: 'File uploader broken on Chrome' }, ...]
```

- Amend a task
```typescript
const taskUpdated = await connector.sdk().tasks.update(tasks.data[0].gid, { name: 'New name' }) // tasks coming from 'Get all tasks for a project' example above
console.log(taskUpdated) // {gid: '0123456789', name: 'New name', ... }
```

- Get the team details
```typescript
const team = await connector.sdk().teams.findById(project.team.gid) // project object coming from 'Get project details' example above 
console.log('team details', team) // { name: 'Engineering', gid: '112233', organization: { name: 'my organisation name', gid: '12345'} ... }
```
