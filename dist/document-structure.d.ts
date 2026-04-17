export interface DocumentStructure {
    hasGoals: boolean;
    namedOptionsCount: number;
    shouldSurfaceCandidatePaths: boolean;
}
export declare function analyzeDocumentStructure(document: string): DocumentStructure;
