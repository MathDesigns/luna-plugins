import { LunaUnload, Tracer } from "@luna/core";
import { redux } from "@luna/lib";
import type { ItemId, SortOrder, SortDirection, ActionPayloads, List } from "@luna/lib/dist/typings/redux";

export const { trace, errSignal } = Tracer("[DeleterPlugin]");

export const unloads = new Set<LunaUnload>();

// --- Shitty observer that will break someday ---
const TRACK_LIST_CONTAINER_SELECTOR = `div[data-type="media-table"]`;
const SELECTED_TRACK_ROW_SELECTOR = `[class*="_tableRowSelected_"]`; 
const TRACK_ID_ATTRIBUTE = "data-track-id";
const TRACK_INDEX_ATTRIBUTE = "data-index";
// --------------------------------------------

const handleKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
    
    if (event.key === "Delete") {
        event.preventDefault();
        event.stopPropagation();

        const trackListContainer = document.querySelector(TRACK_LIST_CONTAINER_SELECTOR);
        if (!trackListContainer) {
            return;
        }

        const selectedRows = trackListContainer.querySelectorAll(SELECTED_TRACK_ROW_SELECTOR);

        if (selectedRows.length === 0) {
            return;
        }

        const indicesToRemove: number[] = [];
        let firstMediaItemId: number | undefined;

        selectedRows.forEach(row => {
            const indexStr = row.getAttribute(TRACK_INDEX_ATTRIBUTE);
            const mediaItemIdStr = row.getAttribute(TRACK_ID_ATTRIBUTE);

            if (indexStr) {
                const selectedIndex = parseInt(indexStr, 10);
                if (!isNaN(selectedIndex)) {
                    indicesToRemove.push(selectedIndex);

                    if (firstMediaItemId === undefined && mediaItemIdStr) {
                        const mediaItemId = parseInt(mediaItemIdStr, 10);
                        if (!isNaN(mediaItemId)) {
                            firstMediaItemId = mediaItemId;
                        }
                    }
                }
            }
        });
        
        if (indicesToRemove.length === 0) {
            trace.msg.warn("Found selected rows, but could not determine their indices. Aborting delete.");
            return;
        }

        try {
            const state = redux.store.getState();
            if (!state) {
                return;
            }

            const routerSearch = state.router?.search;
            let currentPlaylistUUID: ItemId | undefined = routerSearch?.startsWith("?") ? routerSearch.substring(1) : undefined;
            if (!currentPlaylistUUID) {
                currentPlaylistUUID = state.router?.currentParams?.playlistId || state.router?.currentParams?.uuid || state.router?.currentParams?.id;
            }
            
            if (!currentPlaylistUUID) {
                return;
            }
            
            const payload: ActionPayloads["content/REMOVE_MEDIA_ITEMS_FROM_PLAYLIST"] = {
                playlistUUID: String(currentPlaylistUUID),
                removeIndices: indicesToRemove,
                currentOrder: 'INDEX', 
                currentDirection: 'ASC',
                mediaItemId: firstMediaItemId
            };

            redux.store.dispatch({
                type: "content/REMOVE_MEDIA_ITEMS_FROM_PLAYLIST",
                payload: payload,
            });

        } catch (error) {
            trace.msg.err("Error during delete keybind operation:", error);
        }
    }
};

try {
    document.addEventListener("keydown", handleKeyDown, false);
    //trace.msg.log("Plugin setup complete. Listening for 'Delete' key.");

    unloads.add(() => {
        document.removeEventListener("keydown", handleKeyDown, false);
        //trace.msg.log("Keydown listener removed on unload.");
    });

} catch (e) {
    trace.msg.err("Error during main plugin setup:", e);
}
