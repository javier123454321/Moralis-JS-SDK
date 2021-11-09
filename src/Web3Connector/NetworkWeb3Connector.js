import CoreManager from '../CoreManager';
import AbstractWeb3Connector from './AbstractWeb3Connector';
import { getMoralisRpcs } from './MoralisRpcs';

class MiniRpcProvider {
  constructor(chainId, url) {
    this.chainId = chainId;
    this.url = url;
    const parsed = new URL(url);
    this.host = parsed.host;
    this.path = parsed.pathname;
  }

  request = async (method, params) => {
    if (typeof method !== 'string') {
      // eslint-disable-next-line prefer-destructuring
      params = method.params;
      // eslint-disable-next-line prefer-destructuring
      method = method.method;
    }

    const RESTController = CoreManager.getRESTController();

    const response = RESTController.ajax(
      'POST',
      this.url,
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params,
      }),
      {
        'Content-Type': 'application/json',
      }
    );

    if (!response.ok) {
      throw new Error(`${response.status}: ${response.statusText}`, -32000);
    }
    const body = await response.json();
    if ('error' in body) {
      throw new Error(body?.error?.message, body?.error?.code, body?.error?.data);
    } else if ('result' in body) {
      return body.result;
    } else {
      throw new Error(`Received unexpected JSON-RPC response to ${method} request.`, -32000, body);
    }
  };
}

/**
 * Connect to web3 via a network url
 * Note: this has no knowledge of any user accounts
 */
class NetworkWeb3Connector extends AbstractWeb3Connector {
  get type() {
    return 'Network';
  }

  constructor({ urls, defaultChainId, speedyNodeKey }) {
    super();

    if (!urls && speedyNodeKey) {
      urls = getMoralisRpcs(speedyNodeKey);
    }

    if (!urls && !speedyNodeKey) {
      throw new Error(
        'Cannot connect to rpc: No urls or speedyNodeKey provided for NetworkWeb3Connector.'
      );
    }

    this.chainId = defaultChainId ?? Number(Object.keys(urls)[0]);
    this.providers = Object.keys(urls).reduce((accumulator, chainId) => {
      accumulator[Number(chainId)] = new MiniRpcProvider(Number(chainId), urls[Number(chainId)]);
      return accumulator;
    }, {});
  }

  async activate({ chainId: providedChainId } = {}) {
    if (providedChainId) {
      this.chainId = providedChainId;
    }

    const provider = this.providers[this.chainId];

    return { provider, chainId: this.chainId, account: null };
  }

  deactivate() {}

  async getProvider() {
    return this.providers[this.chainId];
  }

  async getChainId() {
    return this.chainId;
  }

  async getAccount() {
    return null;
  }
}

export default NetworkWeb3Connector;
