/** An editor-facing problem with some configuration. */
export interface Problem {
    message: string;
    /** Incomplete or always failing: saving is refused. Otherwise a warning. */
    blocking: boolean;
}
