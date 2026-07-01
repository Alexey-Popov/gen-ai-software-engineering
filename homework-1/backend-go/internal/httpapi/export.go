package httpapi

import (
	"encoding/csv"
	"strings"
	"time"

	"bankingapi/internal/model"
)

var csvHeader = []string{"id", "fromAccount", "toAccount", "amount", "currency", "type", "timestamp", "status"}

// transactionsToCSV renders transactions as RFC 4180 CSV with a header row.
func transactionsToCSV(txs []model.Transaction) string {
	var sb strings.Builder
	w := csv.NewWriter(&sb)
	_ = w.Write(csvHeader)
	for _, t := range txs {
		_ = w.Write([]string{
			t.ID,
			t.FromAccount,
			t.ToAccount,
			t.Amount.String(),
			t.Currency,
			string(t.Type),
			t.Timestamp.Format(time.RFC3339),
			string(t.Status),
		})
	}
	w.Flush()
	return sb.String()
}
