// npm only packs files inside the package folder, so copy the licence in.
import { copyFileSync } from "node:fs";

copyFileSync(new URL("../../../LICENSE", import.meta.url), new URL("../LICENSE", import.meta.url));
