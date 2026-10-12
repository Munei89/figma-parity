import { z } from "zod";
/** How to open and recognise one Figma screen in the running app. */
export declare const screenTargetSchema: z.ZodObject<{
    route: z.ZodOptional<z.ZodString>;
    match: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodInstanceOf<RegExp>]>>;
    deepLink: z.ZodOptional<z.ZodString>;
    marker: z.ZodOptional<z.ZodString>;
    ready: z.ZodOptional<z.ZodString>;
    mask: z.ZodOptional<z.ZodArray<z.ZodString>>;
    visualThreshold: z.ZodOptional<z.ZodNumber>;
    skip: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type ScreenTarget = z.infer<typeof screenTargetSchema>;
declare const webTarget: z.ZodObject<{
    platform: z.ZodLiteral<"web">;
    baseUrl: z.ZodString;
    browser: z.ZodDefault<z.ZodEnum<{
        chromium: "chromium";
        firefox: "firefox";
        webkit: "webkit";
    }>>;
    headless: z.ZodDefault<z.ZodBoolean>;
    storageState: z.ZodOptional<z.ZodString>;
    scale: z.ZodDefault<z.ZodNumber>;
    settleMs: z.ZodDefault<z.ZodNumber>;
    setup: z.ZodOptional<z.ZodCustom<(page: unknown) => Promise<void>, (page: unknown) => Promise<void>>>;
    executablePath: z.ZodOptional<z.ZodString>;
    args: z.ZodOptional<z.ZodArray<z.ZodString>>;
    cdpUrl: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
declare const rnTarget: z.ZodObject<{
    platform: z.ZodLiteral<"react-native">;
    appium: z.ZodObject<{
        hostname: z.ZodDefault<z.ZodString>;
        port: z.ZodDefault<z.ZodNumber>;
        path: z.ZodDefault<z.ZodString>;
        capabilities: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, z.core.$strip>;
    settleMs: z.ZodDefault<z.ZodNumber>;
    setup: z.ZodOptional<z.ZodCustom<(driver: unknown) => Promise<void>, (driver: unknown) => Promise<void>>>;
    statusBarHeight: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const configSchema: z.ZodObject<{
    figma: z.ZodObject<{
        file: z.ZodString;
        token: z.ZodOptional<z.ZodString>;
        snapshotDir: z.ZodOptional<z.ZodString>;
        pages: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
    target: z.ZodDiscriminatedUnion<[z.ZodObject<{
        platform: z.ZodLiteral<"web">;
        baseUrl: z.ZodString;
        browser: z.ZodDefault<z.ZodEnum<{
            chromium: "chromium";
            firefox: "firefox";
            webkit: "webkit";
        }>>;
        headless: z.ZodDefault<z.ZodBoolean>;
        storageState: z.ZodOptional<z.ZodString>;
        scale: z.ZodDefault<z.ZodNumber>;
        settleMs: z.ZodDefault<z.ZodNumber>;
        setup: z.ZodOptional<z.ZodCustom<(page: unknown) => Promise<void>, (page: unknown) => Promise<void>>>;
        executablePath: z.ZodOptional<z.ZodString>;
        args: z.ZodOptional<z.ZodArray<z.ZodString>>;
        cdpUrl: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        platform: z.ZodLiteral<"react-native">;
        appium: z.ZodObject<{
            hostname: z.ZodDefault<z.ZodString>;
            port: z.ZodDefault<z.ZodNumber>;
            path: z.ZodDefault<z.ZodString>;
            capabilities: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>;
        settleMs: z.ZodDefault<z.ZodNumber>;
        setup: z.ZodOptional<z.ZodCustom<(driver: unknown) => Promise<void>, (driver: unknown) => Promise<void>>>;
        statusBarHeight: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>], "platform">;
    screens: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
        route: z.ZodOptional<z.ZodString>;
        match: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodInstanceOf<RegExp>]>>;
        deepLink: z.ZodOptional<z.ZodString>;
        marker: z.ZodOptional<z.ZodString>;
        ready: z.ZodOptional<z.ZodString>;
        mask: z.ZodOptional<z.ZodArray<z.ZodString>>;
        visualThreshold: z.ZodOptional<z.ZodNumber>;
        skip: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>>;
    elements: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    selectorStrategy: z.ZodDefault<z.ZodEnum<{
        none: "none";
        testid: "testid";
    }>>;
    positionalFallback: z.ZodDefault<z.ZodBoolean>;
    checks: z.ZodDefault<z.ZodObject<{
        visual: z.ZodDefault<z.ZodBoolean>;
        styles: z.ZodDefault<z.ZodBoolean>;
        flows: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>;
    thresholds: z.ZodDefault<z.ZodObject<{
        visual: z.ZodDefault<z.ZodNumber>;
        pixel: z.ZodDefault<z.ZodNumber>;
        region: z.ZodDefault<z.ZodNumber>;
        size: z.ZodDefault<z.ZodNumber>;
        color: z.ZodDefault<z.ZodNumber>;
        flowTimeoutMs: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
    output: z.ZodDefault<z.ZodObject<{
        dir: z.ZodDefault<z.ZodString>;
        inline: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ParityConfigInput = z.input<typeof configSchema>;
export type ParityConfig = z.output<typeof configSchema>;
export type WebTargetConfig = z.output<typeof webTarget>;
export type RNTargetConfig = z.output<typeof rnTarget>;
/** Identity helper for typed config files. */
export declare function defineConfig(config: ParityConfigInput): ParityConfigInput;
export declare function parseConfig(input: unknown): ParityConfig;
export declare const CONFIG_FILES: string[];
/**
 * Loads a config file. .ts files rely on Node's built-in type stripping
 * (Node >= 22.18); on older Node use .mjs/.js or run through tsx.
 */
export declare function loadConfig(path?: string, cwd?: string): Promise<ParityConfig>;
export {};
