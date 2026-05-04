export interface EdgeRef {
  key: string;
  title: string;
  sectionPath: string[];
}

export interface FindResult {
  key: string;
  title: string;
  references: EdgeRef[];
  includes: EdgeRef[];
  referencedBy: EdgeRef[];
  includedBy: EdgeRef[];
}

export interface RetrieveResult {
  key: string;
  title: string;
  content: string;
  references: EdgeRef[];
  includes: EdgeRef[];
  referencedBy: EdgeRef[];
  includedBy: EdgeRef[];
}
