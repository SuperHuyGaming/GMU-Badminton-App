/*
 * Copyright Elasticsearch B.V. and contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import { EventEmitter } from 'node:events';
import { ConfigurationError } from './errors.js';
export var events;
(function (events) {
    events["RESPONSE"] = "response";
    events["REQUEST"] = "request";
    events["SNIFF"] = "sniff";
    events["RESURRECT"] = "resurrect";
    events["SERIALIZATION"] = "serialization";
    events["DESERIALIZATION"] = "deserialization";
})(events || (events = {}));
export default class Diagnostic extends EventEmitter {
    on(event, listener) {
        assertSupportedEvent(event);
        super.on(event, listener);
        return this;
    }
    once(event, listener) {
        assertSupportedEvent(event);
        super.once(event, listener);
        return this;
    }
    off(event, listener) {
        assertSupportedEvent(event);
        super.off(event, listener);
        return this;
    }
}
function assertSupportedEvent(event) {
    if (!supportedEvents.includes(event)) {
        throw new ConfigurationError(`The event '${event}' is not supported.`);
    }
}
// @ts-expect-error
const supportedEvents = Object.keys(events).map(key => events[key]);
//# sourceMappingURL=Diagnostic.js.map