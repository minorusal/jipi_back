flowchart TD
    subgraph "Function: getScoreApalancamientoFromSummary"
        A[Start] --> B{Fetch Financial Data}
        B --> C{Data OK?}
        C -- No --> C_NO[Return Error]
        C -- Yes --> D[Calculate Pasivo and Capital]
        D --> E{Numbers valid?}
        E -- No --> E_NO[Return Error]
        E -- Yes --> F["Determine Reported Status: deudaReportada, capitalReportado"]
        F --> G["Calculate Apalancamiento"]
        G --> H[Get Score Configurations]
        H --> I{Evaluation Path}

        subgraph "Score Logic"
            I -- "No Capital AND No Deuda" --> J["Find most negative score from all options"]
            J --> K[Set apalScore]

            I -- "No Capital only" --> L[Set apalScore = noCapitalScore]
            I -- "No Deuda only" --> M[Set apalScore = noDeudaScore]
            I -- "Apalancamiento is valid number" --> N{"Find score in ranges"}
            N -- Found --> O[Set apalScore = matched range]
            N -- "Not Found" --> P[Set apalScore = desconocidoScore]
            I -- "Else" --> P

            L --> K
            M --> K
            O --> K
            P --> K
        end

        K --> Q["Calculate Final Score"]
        Q --> R[Prepare Result Object]
        R --> S[Return Result]
    end

    subgraph "End Points"
        C_NO --> Z[End]
        E_NO --> Z[End]
        S --> Z[End]
    end
