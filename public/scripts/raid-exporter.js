// ==UserScript==
// @name         Earth2 Raid Data Exporter for Earthie.world
// @namespace    http://earthie.world/
// @version      1.3
// @description  Exports Earth2 raid notification history, property, and owner data to a CSV file for use with the Earthie.world Raid Helper.
// @match        https://app.earth2.io/*
// @grant        none
// @author       EugeneBoondock / Earthie.world
// ==/UserScript==

(async () => {
    'use strict';

    // --- Configuration ---
    const CSV_FILENAME = 'earth2_raid_data.csv';
    const NOTIFICATION_PAGE_SIZE = 100;
    const BATCH_DELAY_MS = 500; // Slightly increased delay after batch completion
    const PAGE_DELAY_MS = 200;
    const MAX_NOTIFICATIONS_TO_FETCH = 10000;
    const MAX_PAGES_TO_FETCH = Math.ceil(MAX_NOTIFICATIONS_TO_FETCH / NOTIFICATION_PAGE_SIZE);
    const DETAIL_FETCH_BATCH_SIZE = 40; // Reduced batch size for detail fetching

    // --- Helper Functions ---
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const logStatus = (message, isError = false) => {
        console[isError ? 'error' : 'log'](`[Raid Exporter] ${message}`);
        let statusDiv = document.getElementById('raid-exporter-status');
        if (!statusDiv) {
            statusDiv = document.createElement('div');
            statusDiv.id = 'raid-exporter-status';
            statusDiv.style.position = 'fixed';
            statusDiv.style.bottom = '10px';
            statusDiv.style.left = '10px';
            statusDiv.style.padding = '10px';
            statusDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            statusDiv.style.color = 'white';
            statusDiv.style.zIndex = '10000';
            statusDiv.style.borderRadius = '5px';
            statusDiv.style.fontSize = '12px';
            document.body.appendChild(statusDiv);
        }
        statusDiv.textContent = `Exporter: ${message}`;
        statusDiv.style.color = isError ? 'red' : 'lime';
    };

    const removeStatus = () => {
        const statusDiv = document.getElementById('raid-exporter-status');
        if (statusDiv) {
            statusDiv.remove();
        }
    };

    const escapeCsvValue = (value) => {
        if (value === null || value === undefined) return '';
        let stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
            stringValue = stringValue.replace(/"/g, '""');
            return `"${stringValue}"`;
        }
        return stringValue;
    };

    const convertToCsv = (dataRows) => {
        if (!dataRows || dataRows.length === 0) return '';
        const header = [
            'notification_id', 'event_type', 'timestamp', 'ether_amount',
            'cydroids_sent', 'source_property_id', 'source_property_desc',
            'source_location', 'source_tile_count', 'source_tier', 'source_class',
            'target_property_id', 'target_property_desc', 'target_location',
            'target_owner_id', 'target_owner_username', 'target_tile_count',
            'target_tier', 'target_class'
        ];
        const headerString = header.map(escapeCsvValue).join(',');
        const rows = dataRows.map(row => header.map(fieldName => escapeCsvValue(row[fieldName])).join(','));
        return [headerString, ...rows].join('\n');
    };

    const downloadCsv = (csvContent, filename) => {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } else {
            alert("CSV download not supported in this browser context.");
        }
    };

    // --- Main Export Logic ---
    logStatus("Starting Raid Data Export...");

    // 1. Get React Context and API Client
    let reactContext;
    let apiClient;
    try {
        reactContext = Array.from(document.querySelectorAll("*"))
            .map(el => el[Object.keys(el).find(tk => tk.includes("reactFiber"))])
            .find(zu => zu?.return?.dependencies?.firstContext?.context)
            ?.return?.dependencies?.firstContext?.context?._currentValue;

        if (!reactContext || !reactContext.api || !reactContext.api.apiClient) {
            throw new Error("Could not find Earth2 API context.");
        }
        apiClient = reactContext.api.apiClient;
        logStatus("API context found.");
    } catch (error) {
        logStatus(`Error accessing API context: ${error.message}`, true);
        return;
    }

    // 2. Fetch Raid Notifications using direct 'fetch'
    let allNotifications = [];
    let currentPage = 0;
    let totalFetched = 0;
    let hasMore = true;
    const raidEventTypes = ["DROID_RAID_SUCCESSFUL", "DROID_RAID_FAILED"];

    logStatus("Fetching raid notifications...");
    try {
        while (hasMore && currentPage < MAX_PAGES_TO_FETCH) {
            const offset = currentPage * NOTIFICATION_PAGE_SIZE;
            const url = `/api/v2/my/messages/?message_class=NOTIFICATION&event_type=${raidEventTypes.join(',')}&limit=${NOTIFICATION_PAGE_SIZE}&offset=${offset}`;
            logStatus(`Fetching notifications page ${currentPage + 1}... (Offset: ${offset})`);
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status} fetching ${url}`);
            const responseData = await response.json();
            const notifications = responseData?.results;
            if (!notifications || notifications.length === 0) {
                hasMore = false;
            } else {
                const raidNotifications = notifications.filter(n => n.message_category === "RAIDING" && raidEventTypes.includes(n.event_type));
                allNotifications = allNotifications.concat(raidNotifications);
                totalFetched += raidNotifications.length;
                if (notifications.length < NOTIFICATION_PAGE_SIZE) hasMore = false;
            }
            currentPage++;
            if (hasMore) await sleep(PAGE_DELAY_MS);
            if (totalFetched >= MAX_NOTIFICATIONS_TO_FETCH) {
                logStatus(`Reached maximum notification limit (${MAX_NOTIFICATIONS_TO_FETCH}). Stopping fetch.`, true);
                hasMore = false;
            }
        }
        logStatus(`Fetched ${totalFetched} raid notifications.`);
        if (allNotifications.length === 0) {
            logStatus("No raid notifications found.", true);
            removeStatus();
            return;
        }
    } catch (error) {
        logStatus(`Error fetching notifications: ${error.message || error}`, true);
        removeStatus();
        return;
    }

    // 3. Extract Unique IDs
    const sourcePropertyIds = new Set();
    const targetPropertyIds = new Set();
    const targetOwnerIds = new Set();
    allNotifications.forEach(n => {
        if (n.data?.homeLandfield?.id) sourcePropertyIds.add(n.data.homeLandfield.id);
        if (n.data?.enemyLandfield?.id) targetPropertyIds.add(n.data.enemyLandfield.id);
        if (n.data?.victim?.id) targetOwnerIds.add(n.data.victim.id);
    });
    logStatus(`Found ${sourcePropertyIds.size} unique source properties, ${targetPropertyIds.size} unique target properties, ${targetOwnerIds.size} unique target owners.`);

    // --- Caching fetched data ---
    const propertyCache = new Map();
    const userCache = new Map();

    // Helper to fetch property details, storing promise in cache
    const fetchPropertyDetails = async (propId) => {
        if (propertyCache.has(propId)) return propertyCache.get(propId); // Return existing promise

        const promise = apiClient.get(`/landfields/${propId}`)
            .then(response => {
                if (response?.data) return response.data; // Resolve with data
                throw new Error(`No data for property ${propId}`);
            })
            .catch(err => {
                console.warn(`[Raid Exporter] Failed to fetch details for property ${propId}: ${err.message || 'Network Error'}. Using fallback.`);
                return null; // Resolve with null on failure
            });
        propertyCache.set(propId, promise); // Store the promise
        return promise;
    };

    // Helper to fetch user details, storing promise in cache
     const fetchUserDetails = async (userId) => {
         if (userCache.has(userId)) return userCache.get(userId); // Return existing promise

         const promise = apiClient.get(`/users`, { params: { ids: [userId] } })
             .then(response => {
                 const userData = response?.data?.data?.[0];
                 if (userData) return userData; // Resolve with data
                 console.warn(`[Raid Exporter] No user data found for ID ${userId}.`);
                 return null; // Resolve with null if not found
             })
             .catch(err => {
                 console.warn(`[Raid Exporter] Failed to fetch details for user ${userId}: ${err.message || 'Network Error'}. Using fallback.`);
                 return null; // Resolve with null on failure
             });
         userCache.set(userId, promise); // Store the promise
         return promise;
     };


    // 4. Fetch Property Details (Batching with await Promise.allSettled)
    const allPropertyIds = [...new Set([...sourcePropertyIds, ...targetPropertyIds])];
    logStatus(`Fetching details for ${allPropertyIds.length} unique properties...`);
    for (let i = 0; i < allPropertyIds.length; i += DETAIL_FETCH_BATCH_SIZE) {
        const batchIds = allPropertyIds.slice(i, i + DETAIL_FETCH_BATCH_SIZE);
        const currentBatchNum = Math.floor(i / DETAIL_FETCH_BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(allPropertyIds.length / DETAIL_FETCH_BATCH_SIZE);
        logStatus(`Initiating property details fetch batch ${currentBatchNum}/${totalBatches}...`);

        // Initiate all fetches for the batch
        const batchPromises = batchIds.map(id => fetchPropertyDetails(id));

        // **** Wait for the current batch to complete (or fail) ****
        logStatus(`Waiting for property batch ${currentBatchNum}/${totalBatches} to complete...`);
        await Promise.allSettled(batchPromises);
        logStatus(`Property batch ${currentBatchNum}/${totalBatches} finished.`);

        // Wait before starting the next batch
        await sleep(BATCH_DELAY_MS);
    }
    logStatus("Finished fetching property details.");


    // 5. Fetch Owner Details (Batching with await Promise.allSettled)
    const ownerIdList = Array.from(targetOwnerIds);
    logStatus(`Fetching details for ${ownerIdList.length} unique owners...`);
    for (let i = 0; i < ownerIdList.length; i += DETAIL_FETCH_BATCH_SIZE) {
        const batchIds = ownerIdList.slice(i, i + DETAIL_FETCH_BATCH_SIZE);
         const currentBatchNum = Math.floor(i / DETAIL_FETCH_BATCH_SIZE) + 1;
         const totalBatches = Math.ceil(ownerIdList.length / DETAIL_FETCH_BATCH_SIZE);
        logStatus(`Initiating owner details fetch batch ${currentBatchNum}/${totalBatches}...`);

        // Initiate all fetches for the batch
        const batchPromises = batchIds.map(id => fetchUserDetails(id));

        // **** Wait for the current batch to complete (or fail) ****
        logStatus(`Waiting for owner batch ${currentBatchNum}/${totalBatches} to complete...`);
        await Promise.allSettled(batchPromises);
        logStatus(`Owner batch ${currentBatchNum}/${totalBatches} finished.`);

        // Wait before starting the next batch
        await sleep(BATCH_DELAY_MS);
    }
    logStatus("Finished fetching owner details.");


    // 6. Combine Data into Final Rows
    logStatus("Combining data for CSV... Resolving final details.");
    const csvDataRows = [];

    for (const n of allNotifications) {
        try {
            const sourcePropId = n.data?.homeLandfield?.id;
            const targetPropId = n.data?.enemyLandfield?.id;
            const ownerId = n.data?.victim?.id;

            if (!sourcePropId || !targetPropId || !ownerId) {
                console.warn(`[Raid Exporter] Skipping notification ${n.id} due to missing essential IDs.`);
                continue;
            }

            // Await the promises (will return resolved data/null immediately if already settled)
            const sourcePropData = await propertyCache.get(sourcePropId);
            const targetPropData = await propertyCache.get(targetPropId);
            const ownerData = await userCache.get(ownerId);

            // Use fetched data if available, otherwise fallback to notification data
            const sourceDesc = sourcePropData?.attributes?.description ?? n.data?.homeLandfield?.description ?? 'N/A';
            const sourceLoc = sourcePropData?.attributes?.location ?? n.data?.homeLandfield?.location ?? 'N/A';
            const sourceTiles = sourcePropData?.attributes?.tileCount ?? n.data?.homeLandfield?.tile_count ?? 0;
            const sourceTier = sourcePropData?.attributes?.landfieldTier ?? n.data?.homeLandfield?.landfield_tier ?? 0;
            const sourceClass = sourcePropData?.attributes?.tileClass ?? n.data?.homeLandfield?.tile_class ?? '-';

            const targetDesc = targetPropData?.attributes?.description ?? n.data?.enemyLandfield?.description ?? 'N/A';
            const targetLoc = targetPropData?.attributes?.location ?? n.data?.enemyLandfield?.location ?? 'N/A';
            const targetTiles = targetPropData?.attributes?.tileCount ?? n.data?.enemyLandfield?.tile_count ?? 0;
            const targetTier = targetPropData?.attributes?.landfieldTier ?? n.data?.enemyLandfield?.landfield_tier ?? 0;
            const targetClass = targetPropData?.attributes?.tileClass ?? n.data?.enemyLandfield?.tile_class ?? '-';

            const ownerUsername = ownerData?.attributes?.username ?? n.data?.victim?.username ?? 'N/A';

            csvDataRows.push({
                notification_id: n.id,
                event_type: n.event_type,
                timestamp: n.created,
                ether_amount: n.data?.etherAmount ?? 0,
                cydroids_sent: n.data?.cydroidsSent ?? 0,
                source_property_id: sourcePropId,
                source_property_desc: sourceDesc,
                source_location: sourceLoc,
                source_tile_count: sourceTiles,
                source_tier: sourceTier,
                source_class: sourceClass,
                target_property_id: targetPropId,
                target_property_desc: targetDesc,
                target_location: targetLoc,
                target_owner_id: ownerId,
                target_owner_username: ownerUsername,
                target_tile_count: targetTiles,
                target_tier: targetTier,
                target_class: targetClass,
            });
        } catch (combineError) {
            console.error(`[Raid Exporter] Error processing notification ${n.id}: ${combineError.message}. Skipping row.`);
        }
    }

    // 7. Convert to CSV and Download
    if (csvDataRows.length > 0) {
        logStatus("Generating CSV file...");
        try {
            const csvContent = convertToCsv(csvDataRows);
            downloadCsv(csvContent, CSV_FILENAME);
            logStatus(`Export complete! ${csvDataRows.length} raid records saved to ${CSV_FILENAME}.`);
        } catch (csvError) {
            logStatus(`Error generating or downloading CSV: ${csvError.message}`, true);
        }
    } else {
        logStatus("No valid raid data rows generated for CSV.", true);
    }

    removeStatus();

})(); // Execute the async function