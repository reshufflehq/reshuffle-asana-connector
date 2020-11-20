import { Request, Response } from 'express'
import { Reshuffle, BaseHttpConnector, EventConfiguration } from 'reshuffle-base-connector'
import Asana from 'asana'

const DEFAULT_WEBHOOK_PATH = '/reshuffle-asana-connector/webhook'

function validateBaseURL(url?: string): string {
  if (typeof url !== 'string') {
    throw new Error(`Invalid url: ${url}`)
  }
  const match = url.match(/^(https:\/\/[\w-]+(\.[\w-]+)*(:\d{1,5})?)\/?$/)
  if (!match) {
    throw new Error(`Invalid url: ${url}`)
  }
  return match[1]
}

type AsanaWebhooks = { data: [{ resource: { gid: string }; active: boolean; target: string }] }
type AsanaEvent = '*' | 'deleted' | 'undeleted' | 'added' | 'removed' | 'changed'

// https://developers.asana.com/docs/webhooks
export interface AsanaConnectorConfigOptions {
  accessToken: string
  baseURL?: string
  webhookPath?: string
  workspaceId?: string
}

export interface AsanaConnectorEventOptions {
  gid: string
  asanaEvent?: AsanaEvent
}

export default class AsanaConnector extends BaseHttpConnector<
  AsanaConnectorConfigOptions,
  AsanaConnectorEventOptions
> {
  private readonly _sdk: Asana.Client

  constructor(app: Reshuffle, options: AsanaConnectorConfigOptions, id?: string) {
    super(app, options, id)
    this._sdk = Asana.Client.create().useAccessToken(options.accessToken)
  }

  async onStart(): Promise<void> {
    const logger = this.app.getLogger()
    const events = Object.values(this.eventConfigurations)
    if (events.length) {
      if (!this.configOptions.workspaceId) {
        throw new Error(
          'Asana Connector - error creating event. You must provide a workspaceId in your connector configuration',
        )
      }
      const url = validateBaseURL(this.configOptions.baseURL)

      const webhookUrl = url + (this.configOptions.webhookPath || DEFAULT_WEBHOOK_PATH)
      const webhooks = (await this._sdk.webhooks.getAll(
        this.configOptions.workspaceId,
      )) as AsanaWebhooks

      for (const { options } of events) {
        const existingWebhook = webhooks.data.find(
          (asanaWebhook) =>
            options.gid === asanaWebhook.resource.gid &&
            asanaWebhook.target === webhookUrl &&
            asanaWebhook.active,
        )

        if (!existingWebhook) {
          const webhook = await this._sdk.webhooks.create(events[0].options.gid, webhookUrl, {})

          if (webhook.active) {
            logger.info(
              `Reshuffle Asana - webhook registered successfully (gid: ${webhook.gid}, target: ${webhook.target})`,
            )
          } else {
            logger.error(
              `Reshuffle Asana - webhook registration failure (gid: ${webhook.gid}, target: ${webhook.target})`,
            )
          }
        } else {
          logger.info(
            `Reshuffle Asana - using existing webhook (gid: ${existingWebhook.resource.gid}, target: ${existingWebhook.target})`,
          )
        }
      }
    }
  }

  on(options: AsanaConnectorEventOptions, handler: any, eventId: string): EventConfiguration {
    options.asanaEvent = options.asanaEvent || '*'
    const path = this.configOptions.webhookPath || DEFAULT_WEBHOOK_PATH

    if (!eventId) {
      eventId = `Asana${path}/${options.gid}/${options.asanaEvent}/${this.id}`
    }
    const event = new EventConfiguration(eventId, this, options)
    this.eventConfigurations[event.id] = event

    this.app.when(event, handler)
    this.app.registerHTTPDelegate(path, this)

    return event
  }

  sdk(): Asana.Client {
    return this._sdk
  }

  async handle(req: Request, res: Response): Promise<boolean> {
    const secretWebhookRegistrationHeader = req.headers['x-hook-secret']

    if (secretWebhookRegistrationHeader) {
      res.set({ 'x-hook-secret': secretWebhookRegistrationHeader }).send()
      return true
    } else {
      // Acknowledge that you received those events so Asana won't send them again
      res.send()
    }

    const asanaEventsTriggered = req.body.events

    for (const asanaEvent of asanaEventsTriggered) {
      const eventsUsingAsanaEvent = Object.values(this.eventConfigurations).filter(
        ({ options }) => options.asanaEvent === '*' || options.asanaEvent === asanaEvent.action,
      )

      for (const event of eventsUsingAsanaEvent) {
        await this.app.handleEvent(event.id, {
          ...event,
          ...asanaEvent,
        })
      }
    }

    return true
  }
}

export { AsanaConnector }
