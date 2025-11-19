/* eslint-disable @typescript-eslint/no-explicit-any */

export type Database = {
  public: {
    Tables: {
      entries: {
        Row: any // temporary
        Insert: any
        Update: any
      }
      // add other tables if you want
    }
  }
}
