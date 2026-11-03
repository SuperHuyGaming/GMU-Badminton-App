// Preloaded into the API (node -r no-kafka.cjs server.js) because this machine has no Kafka broker.
// Without it every User.save() waits on kafkajs connection retries (measured ~13s per sign-up),
// see server/models/User.js post("save") -> utils/kafkaProducer.js publishEvent.
// Replaces the kafkajs module with no-op admin/producer/consumer objects. Disable with REAL_KAFKA=1.
const Module = require("module");
const origLoad = Module._load;
const noop = async () => {};
const fakeClient = () => ({
	connect: noop, disconnect: noop, send: noop, sendBatch: noop, createTopics: async () => true,
	subscribe: noop, run: noop, stop: noop, on: () => {}, events: {},
});
const fake = {
	Kafka: class { constructor() {} admin() { return fakeClient(); } producer() { return fakeClient(); } consumer() { return fakeClient(); } },
	Partitioners: { LegacyPartitioner: () => () => 0, DefaultPartitioner: () => () => 0 },
	logLevel: { NOTHING: 0, ERROR: 1, WARN: 2, INFO: 4, DEBUG: 5 },
	CompressionTypes: {},
};
Module._load = function (request, parent, isMain) {
	if (request === "kafkajs") return fake;
	return origLoad.apply(this, arguments);
};
console.log("[twobots] kafkajs stubbed (no broker on this machine)");
