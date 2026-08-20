(() => {
    const seen = new Set();
    let lastDomAttempt = 0;

    window.addEventListener("message", (event) => {
        if (event.source !== window || event.data?.source !== "leetcode-progress-tracker") return;
        const record = findRecord(event.data.payload);
        if (record) submit(record);
    });

    const observer = new MutationObserver(() => {
        if (Date.now() - lastDomAttempt < 500) return;
        lastDomAttempt = Date.now();
        const record = extractFromDom();
        if (record) submit(record);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

    function submit(record) {
        const fingerprint = JSON.stringify(record);
        if (seen.has(fingerprint)) return;
        seen.add(fingerprint);
        chrome.runtime.sendMessage({ type: "LEETCODE_ACCEPTED_SUBMISSION", data: record }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("[LeetCode Tracker] Could not contact background worker:", chrome.runtime.lastError.message);
            } else if (!response?.ok) {
                console.error("[LeetCode Tracker] Submission was not saved:", response?.error);
            }
        });
    }

    function extractFromDom() {
        const pageText = document.body?.innerText || "";
        if (!/accepted/i.test(pageText)) return null;
        const runtime = pageText.match(/Runtime:\s*([\d.]+)\s*ms/i)?.[1] || pageText.match(/([\d.]+)\s*ms/i)?.[1];
        const memory = pageText.match(/Memory:\s*([\d.]+)\s*MB/i)?.[1] || pageText.match(/([\d.]+)\s*MB/i)?.[1];
        const title = document.querySelector("h1")?.textContent?.trim() || getTitleFromPath();
        const difficulty = [...document.querySelectorAll("span, div")]
            .map((node) => node.textContent.trim())
            .find((text) => /^(Easy|Medium|Hard)$/.test(text));
        if (!title || !difficulty || runtime === undefined || memory === undefined) return null;
        return makeRecord(title, difficulty, runtime, memory);
    }

    function findRecord(payload) {
        const candidate = findAcceptedObject(payload);
        if (!candidate) return null;
        const title = candidate.questionTitle || candidate.problemTitle || candidate.title || getTitleFromPath();
        const difficulty = candidate.difficulty || candidate.question?.difficulty || findDifficulty(payload);
        const runtime = candidate.runtime ?? candidate.runtimeMilliseconds ?? candidate.runtime_ms;
        const memory = candidate.memory ?? candidate.memoryMegabytes ?? candidate.memory_mb;
        if (!title || !difficulty || runtime === undefined || memory === undefined) return null;
        return makeRecord(title, difficulty, runtime, memory);
    }

    function findAcceptedObject(value) {
        if (!value || typeof value !== "object") return null;
        if (Object.entries(value).some(([key, item]) => /status|statusMsg|statusMessage/i.test(key) && /accepted/i.test(String(item)))) return value;
        for (const child of Object.values(value)) {
            const result = findAcceptedObject(child);
            if (result) return result;
        }
        return null;
    }

    function findDifficulty(value) {
        const text = JSON.stringify(value);
        return text.match(/"difficulty"\s*:\s*"(Easy|Medium|Hard)"/i)?.[1];
    }

    function getTitleFromPath() {
        const slug = location.pathname.match(/\/problems\/([^/]+)/)?.[1];
        return slug ? slug.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ") : null;
    }

    function makeRecord(title, difficulty, runtime, memory) {
        return {
            problem_title: String(title),
            difficulty: String(difficulty),
            runtime_ms: Number.parseFloat(runtime),
            memory_mb: Number.parseFloat(memory),
            submitted_at: new Date().toISOString(),
            source_url: location.href
        };
    }
})();
