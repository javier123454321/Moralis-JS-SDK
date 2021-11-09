/* eslint-disable no-console */
import EventEmitter from 'events';

/**
 * Abstract connector to connect EIP-1193 providers to Moralis
 *
 * It must implement at least:
 * - activate()
 *
 * It should implement:
 * - Emit ConnectorEvent.CHAIN_CHANGED when the chain has changed
 * - Emit ConnectorEvent.ACCOUNT_CHANGED when the account has changed
 * - deactivate(): to cleanup event listeners and stale references
 * - type: a name to identify
 * - network: the network type that is used (eg. evm)
 */
class AbstractWeb3Connector extends EventEmitter {
  type = 'abstract';
  network = null;
  account = null;
  chainId = null;

  /**
   * Activates the provider.
   * Returns an object with:
   * - provider: A valid EIP-1193 provider
   * - chainId(optional): the chainId that has been connected to (in hex format)
   * - account(optional): the address that is connected to the provider
   */
  async activate() {
    console.log('Not implemented: activate()');
  }

  /**
   * Cleans all active listners and stale references
   */
  deactivate() {
    console.log('Not implemented: deactivate()');
  }
}

export default AbstractWeb3Connector;
