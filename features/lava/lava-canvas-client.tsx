"use client";

import dynamic from "next/dynamic";

// ssr: false is only valid inside a Client Component (this file is one).
const LavaEntropyCanvas = dynamic(
    () => import("./lava-entropy-canvas"),
    { ssr: false },
);

export { LavaEntropyCanvas };
