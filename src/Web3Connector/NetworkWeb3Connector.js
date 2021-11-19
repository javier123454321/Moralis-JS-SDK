import CoreManager from '../CoreManager';
import { fromHexToDecimal } from '../utils/convert';
import verifyChainId from '../utils/verifyChainId';
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
  type = 'network';

  constructor({ urls, defaultChainId, speedyNodeKey } = {}) {
    super();

    if (!urls && speedyNodeKey) {
      urls = getMoralisRpcs(speedyNodeKey);
    }

    if (!urls && !speedyNodeKey) {
      throw new Error(
        'Cannot connect to rpc: No urls or speedyNodeKey provided for NetworkWeb3Connector.'
      );
    }
    if (process.env.PARSE_BUILD !== 'node' && speedyNodeKey) {
      // eslint-disable-next-line no-console
      console.warn(
        'Using speedyNodeKey on the browser enviroment is not recommended, as it is publicly visible.'
      );
    }

    this.chainId = verifyChainId(defaultChainId ?? Number(Object.keys(urls)[0]));
    this.providers = Object.keys(urls).reduce((accumulator, chainId) => {
      accumulator[Number(chainId)] = new MiniRpcProvider(Number(chainId), urls[Number(chainId)]);
      return accumulator;
    }, {});
  }

  async activate({ chainId: providedChainId } = {}) {
    if (providedChainId) {
      this.chainId = verifyChainId(providedChainId);
    }

    const provider = this.providers[fromHexToDecimal(this.chainId)];

    if (!provider) {
      throw new Error(`No rpc url provided for chainId ${this.chainId}`);
    }

    return { provider, chainId: this.chainId, account: null };
  }
}

export default NetworkWeb3Connector;
