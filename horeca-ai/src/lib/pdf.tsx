import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { Quote, QuoteLine, Product, Customer } from "@prisma/client";
import { toDecimal } from "@/lib/utils";

interface QuoteWithRelations extends Quote {
  customer: Customer;
  lines: (QuoteLine & { product: Product | null })[];
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#111" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  companyBlock: { fontSize: 9, color: "#444" },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#666" },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontWeight: "bold", marginBottom: 4, color: "#222" },
  customer: { fontSize: 10, lineHeight: 1.4 },
  table: { display: "flex", flexDirection: "column", borderTop: "1pt solid #ddd" },
  row: { flexDirection: "row", borderBottom: "1pt solid #eee", padding: 6 },
  rowHeader: { flexDirection: "row", borderBottom: "1pt solid #aaa", padding: 6, backgroundColor: "#f7f7f7", fontWeight: "bold" },
  cSku: { width: "12%" },
  cName: { width: "44%" },
  cQty: { width: "8%", textAlign: "right" },
  cPrice: { width: "12%", textAlign: "right" },
  cDisc: { width: "8%", textAlign: "right" },
  cTotal: { width: "16%", textAlign: "right" },
  totals: { marginTop: 14, alignSelf: "flex-end", width: "40%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", padding: 4 },
  grand: { fontSize: 12, fontWeight: "bold", borderTop: "1pt solid #333", paddingTop: 6, marginTop: 4 },
  footer: { marginTop: 30, fontSize: 8, color: "#777", lineHeight: 1.5 },
});

function fmt(n: number) {
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(n);
}

export async function renderQuotePdf(quote: QuoteWithRelations): Promise<Buffer> {
  const companyName = process.env.COMPANY_NAME ?? "HoReCa Distribution";
  const companyAddr = process.env.COMPANY_ADDRESS ?? "";
  const companyVat = process.env.COMPANY_VAT ?? "";
  const companyEmail = process.env.COMPANY_EMAIL ?? "";
  const companyPhone = process.env.COMPANY_PHONE ?? "";

  const totalHT = toDecimal(quote.totalHT);
  const totalTTC = toDecimal(quote.totalTTC);
  const tva = totalTTC - totalHT;

  return renderToBuffer(
    <Document title={`Devis ${quote.number}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Devis {quote.number}</Text>
            <Text style={styles.subtitle}>
              Émis le {new Intl.DateTimeFormat("fr-BE", { dateStyle: "long" }).format(quote.createdAt)}
            </Text>
            {quote.validUntil ? (
              <Text style={styles.subtitle}>
                Valable jusqu&apos;au{" "}
                {new Intl.DateTimeFormat("fr-BE", { dateStyle: "long" }).format(quote.validUntil)}
              </Text>
            ) : null}
          </View>
          <View style={styles.companyBlock}>
            <Text style={{ fontWeight: "bold" }}>{companyName}</Text>
            <Text>{companyAddr}</Text>
            <Text>TVA: {companyVat}</Text>
            <Text>{companyEmail}</Text>
            <Text>{companyPhone}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client</Text>
          <View style={styles.customer}>
            <Text>{quote.customer.companyName}</Text>
            {quote.customer.contactName ? <Text>{quote.customer.contactName}</Text> : null}
            {quote.customer.addrLine1 ? <Text>{quote.customer.addrLine1}</Text> : null}
            {quote.customer.zip || quote.customer.city ? (
              <Text>
                {quote.customer.zip} {quote.customer.city}
              </Text>
            ) : null}
            {quote.customer.vatNumber ? <Text>TVA: {quote.customer.vatNumber}</Text> : null}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.rowHeader}>
            <Text style={styles.cSku}>Réf.</Text>
            <Text style={styles.cName}>Désignation</Text>
            <Text style={styles.cQty}>Qté</Text>
            <Text style={styles.cPrice}>P.U. HT</Text>
            <Text style={styles.cDisc}>Rem.%</Text>
            <Text style={styles.cTotal}>Total HT</Text>
          </View>
          {quote.lines.map((l) => {
            const qty = toDecimal(l.qty);
            const unit = toDecimal(l.unitPriceHT);
            const disc = toDecimal(l.discountPct);
            const lineHT = qty * unit * (1 - disc / 100);
            return (
              <View key={l.id} style={styles.row}>
                <Text style={styles.cSku}>{l.product?.sku ?? "—"}</Text>
                <Text style={styles.cName}>
                  {l.product?.name ?? l.customLabel ?? ""}
                  {l.description ? `\n${l.description}` : ""}
                </Text>
                <Text style={styles.cQty}>{qty}</Text>
                <Text style={styles.cPrice}>{fmt(unit)}</Text>
                <Text style={styles.cDisc}>{disc.toFixed(2)}</Text>
                <Text style={styles.cTotal}>{fmt(lineHT)}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Total HT</Text>
            <Text>{fmt(totalHT)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>TVA</Text>
            <Text>{fmt(tva)}</Text>
          </View>
          <View style={[styles.totalRow, styles.grand]}>
            <Text>Total TTC</Text>
            <Text>{fmt(totalTTC)}</Text>
          </View>
        </View>

        {quote.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text>{quote.notes}</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>
          Devis non contractuel. Prix HT, hors livraison et installation sauf mention. Les marchandises restent
          notre propriété jusqu&apos;au paiement intégral. Conditions générales disponibles sur demande.
        </Text>
      </Page>
    </Document>,
  );
}
