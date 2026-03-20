import React from "react";
import styles from "./page.module.css";
import RandomDisplay from "@/features/lava/random-display";
import { LavaEntropyCanvas } from "@/features/lava/lava-canvas-client";

export default function Home(): React.JSX.Element {
    return (
        <main className={styles.page}>
            <div className={styles.canvasWrap}>
                <LavaEntropyCanvas className={styles.canvas} />
                <div className={styles.overlay}>
                    <h1 className={styles.title}>LavaEntropy</h1>
                    <p className={styles.subtitle}>
                        Visual chaos + system entropy → unpredictable randomness
                    </p>
                    <RandomDisplay />
                </div>
            </div>
        </main>
    );
}
