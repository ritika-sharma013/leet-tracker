importScripts("config.js");

const recentSubmissions = new Map();
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== "LEETCODE_ACCEPTED_SUBMISSION") {
        return undefined;
    }

    saveSubmission(message.data)
        .then(() => sendResponse({ ok: true }))
        .catch((error) => {
            console.error("[LeetCode Tracker] Supabase request failed:", error);
            sendResponse({ ok: false, error: error.message });
        });

    return true;
});

async function saveSubmission(data) {
    const config = globalThis.LEETCODE_TRACKER_CONFIG;
    validateConfig(config);

    const record = normalizeRecord(data);
    const fingerprint = [
        record.problem_title,
        record.runtime_ms,
        record.memory_mb,
        record.source_url
    ].join("|");
    const now = Date.now();

    for (const [key, timestamp] of recentSubmissions) {
        if (now - timestamp > DEDUPE_WINDOW_MS) {
            recentSubmissions.delete(key);
        }
    }
    if (recentSubmissions.has(fingerprint)) {
        console.debug("[LeetCode Tracker] Duplicate submission ignored.");
        return;
    }

    const endpoint = `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/${config.tableName}`;
    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            apikey: config.supabaseAnonKey,
            Authorization: `Bearer ${config.supabaseAnonKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal"
        },
        body: JSON.stringify(record)
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    recentSubmissions.set(fingerprint, now);
    console.info("[LeetCode Tracker] Accepted submission saved:", record);
}

function validateConfig(config) {
    if (!config?.supabaseUrl || config.supabaseUrl.includes("YOUR_PROJECT_REF") ||
        !config.supabaseAnonKey || config.supabaseAnonKey.includes("YOUR_SUPABASE")) {
        throw new Error("Update supabaseUrl and supabaseAnonKey in config.js.");
    }
}

function normalizeRecord(data) {
    const required = ["problem_title", "difficulty", "runtime_ms", "memory_mb"];
    for (const field of required) {
        if (data?.[field] === undefined || data?.[field] === null || data[field] === "") {
            throw new Error(`Submission is missing ${field}.`);
        }
    }
    return {
        problem_title: String(data.problem_title),
        difficulty: String(data.difficulty),
        runtime_ms: Number(data.runtime_ms),
        memory_mb: Number(data.memory_mb),
        submitted_at: data.submitted_at || new Date().toISOString(),
        source_url: data.source_url || "https://leetcode.com/"
    };
}
