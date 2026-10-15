// Korean-client EE.log lines the English matchers miss. Dependency-free
// so the DBWIN worker thread can import it.

export const KO_TRADE_SUCCESS = "거래가 성사되었습니다!";

/** Extra real-time (DBWIN) prefilter substrings, already lowercase. The dialog
 *  itself passes the "dialog::createokcancel" entry. */
export const KO_DEBUG_LINE_SUBSTRINGS = [KO_TRADE_SUCCESS] as const;
