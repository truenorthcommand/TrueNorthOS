/// <reference path="./types.d.ts" />
import { getQBO } from './auth';
import { storage } from '../../storage';
import type { Invoice, Client } from '@shared/schema';

function qboPromise(qbo: any, method: string, ...args: any[]): Promise<any> {
  return new Promise((resolve, reject) => {
    (qbo as any)[method](...args, (err: any, result: any) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

async function findOrCreateQBCustomer(qbo: any, client: Client): Promise<any> {
  const existing = await qboPromise(qbo, 'findCustomers', {
    DisplayName: client.name,
    fetchAll: true,
  }).catch(() => ({ QueryResponse: { Customer: [] } }));

  const customers = existing?.QueryResponse?.Customer || [];
  if (customers.length > 0) return customers[0];

  const newCustomer: any = {
    DisplayName: client.name,
    PrimaryEmailAddr: client.email ? { Address: client.email } : undefined,
    PrimaryPhone: client.phone ? { FreeFormNumber: client.phone } : undefined,
  };

  if (client.address) {
    newCustomer.BillAddr = {
      Line1: client.address,
      PostalCode: client.postcode || '',
      Country: 'GB',
    };
  }

  return qboPromise(qbo, 'createCustomer', newCustomer);
}

export async function syncInvoiceToQuickBooks(invoiceId: string): Promise<{ qbInvoiceId: string }> {
  const qbo = await getQBO();

  const invoice = await storage.getInvoice(invoiceId);
  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

  let qbCustomer: any;
  if (invoice.customerId) {
    const client = await storage.getClient(invoice.customerId);
    if (client) {
      qbCustomer = await findOrCreateQBCustomer(qbo, client);
    }
  }

  if (!qbCustomer) {
    qbCustomer = await findOrCreateQBCustomer(qbo, {
      id: '',
      name: invoice.customerName,
      email: invoice.customerEmail,
      phone: invoice.customerPhone,
      address: invoice.siteAddress,
      postcode: invoice.sitePostcode,
    } as Client);
  }

  const lineItems = (invoice.lineItems as any[]) || [];
  const qbLineItems = lineItems.map((item: any, idx: number) => ({
    DetailType: 'SalesItemLineDetail',
    Amount: (item.quantity || 1) * (item.unitPrice || item.rate || 0),
    Description: item.description || item.name || `Line item ${idx + 1}`,
    SalesItemLineDetail: {
      UnitPrice: item.unitPrice || item.rate || 0,
      Qty: item.quantity || 1,
    },
  }));

  if (invoice.vatAmount && invoice.vatAmount > 0) {
    qbLineItems.push({
      DetailType: 'SalesItemLineDetail',
      Amount: invoice.vatAmount,
      Description: `VAT @ ${invoice.vatRate || 20}%`,
      SalesItemLineDetail: {
        UnitPrice: invoice.vatAmount,
        Qty: 1,
      },
    });
  }

  const qbInvoice: any = {
    DocNumber: invoice.invoiceNo,
    CustomerRef: { value: qbCustomer.Id },
    Line: qbLineItems,
    DueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : undefined,
    TxnDate: invoice.invoiceDate ? new Date(invoice.invoiceDate).toISOString().split('T')[0] : undefined,
    CurrencyRef: { value: 'GBP' },
    PrivateNote: invoice.notes || undefined,
  };

  const created = await qboPromise(qbo, 'createInvoice', qbInvoice);

  return { qbInvoiceId: created.Id };
}

export async function syncPaymentToQuickBooks(
  invoiceId: string,
  amount: number,
  paymentDate: Date
): Promise<{ qbPaymentId: string }> {
  const qbo = await getQBO();

  const invoice = await storage.getInvoice(invoiceId);
  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

  let qbCustomer: any;
  if (invoice.customerId) {
    const client = await storage.getClient(invoice.customerId);
    if (client) {
      qbCustomer = await findOrCreateQBCustomer(qbo, client);
    }
  }

  const qbInvoices = await qboPromise(qbo, 'findInvoices', {
    DocNumber: invoice.invoiceNo,
    fetchAll: true,
  }).catch(() => ({ QueryResponse: { Invoice: [] } }));

  const matchingInvoice = qbInvoices?.QueryResponse?.Invoice?.[0];
  if (!matchingInvoice) {
    throw new Error(`Invoice ${invoice.invoiceNo} not found in QuickBooks. Sync the invoice first.`);
  }

  const payment: any = {
    TotalAmt: amount,
    CustomerRef: qbCustomer ? { value: qbCustomer.Id } : { value: matchingInvoice.CustomerRef.value },
    CurrencyRef: { value: 'GBP' },
    TxnDate: paymentDate.toISOString().split('T')[0],
    Line: [
      {
        Amount: amount,
        LinkedTxn: [
          {
            TxnId: matchingInvoice.Id,
            TxnType: 'Invoice',
          },
        ],
      },
    ],
  };

  const created = await qboPromise(qbo, 'createPayment', payment);
  return { qbPaymentId: created.Id };
}

export async function getQuickBooksCompanyInfo(): Promise<any> {
  const qbo = await getQBO();
  return qboPromise(qbo, 'getCompanyInfo', qbo.realmId);
}
