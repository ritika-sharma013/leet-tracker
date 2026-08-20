(() => {
    const originalFetch = window.fetch;
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        inspectResponse(response.clone(), args[0]);
        return response;
    };

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        this.__leetcodeTrackerUrl = url;
        return originalOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function (...args) {
        this.addEventListener("load", () => {
            if (String(this.__leetcodeTrackerUrl).includes("graphql")) {
                try {
                    inspectPayload(JSON.parse(this.responseText));
                } catch (error) {
                    console.debug("[LeetCode Tracker] Could not parse XHR response:", error);
                }
            }
        });
        return originalSend.apply(this, args);
    };

    function inspectResponse(response, request) {
        const url = typeof request === "string" ? request : request?.url;
        if (!url?.includes("graphql")) return;
        response.json().then(inspectPayload).catch((error) => {
            console.debug("[LeetCode Tracker] Could not parse fetch response:", error);
        });
    }

    function inspectPayload(payload) {
        const text = JSON.stringify(payload);
        if (!/accepted/i.test(text) || !/(runtime|memory)/i.test(text)) return;
        window.postMessage({
            source: "leetcode-progress-tracker",
            type: "GRAPHQL_SUBMISSION_RESULT",
            payload
        }, "*");
    }
})();
