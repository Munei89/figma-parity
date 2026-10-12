/** A hotspot exists but can't be interacted with: a real finding, not a tool error. */
export class InteractionError extends Error {
    name = "InteractionError";
}
