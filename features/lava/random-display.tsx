"use client";

import React, { useState, useCallback } from "react";
import type { RandomResponse } from "@/types/api";
import styles from "./random-display.module.css";

export default function RandomDisplay(): React.JSX.Element {
    const [values, setValues] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [count, setCount] = useState(1);

    const generate = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/random?n=${count}`);
            if (!res.ok) {
                const body = await res.json();
                throw new Error((body as { error?: string }).error ?? "Request failed");
            }
            const data: RandomResponse = await res.json();
            const list = Array.isArray(data.random) ? data.random : [data.random];
            setValues(list);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    }, [count]);

    return (
        <div className={styles.container}>
            <div className={styles.controls}>
                <label className={styles.label} htmlFor="count">
                    Count
                </label>
                <input
                    id="count"
                    type="number"
                    min={1}
                    max={64}
                    value={count}
                    onChange={(e) => setCount(Math.min(64, Math.max(1, Number(e.target.value))))}
                    className={styles.input}
                />
                <button onClick={generate} disabled={loading} className={styles.button}>
                    {loading ? "Generating…" : "Generate"}
                </button>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            {values.length > 0 && (
                <ul className={styles.results}>
                    {values.map((v, i) => (
                        <li key={i} className={styles.result}>
                            <span className={styles.index}>{i + 1}</span>
                            <code className={styles.hash}>{v}</code>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
