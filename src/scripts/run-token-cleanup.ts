import { runTokenCleanup } from "../jobs/run-token-cleanup";

const counts = await runTokenCleanup();
console.log("Limpieza completada:", counts);
