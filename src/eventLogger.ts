import net from 'net';
import { resolve } from 'path';

const EnumIMHeaderMsgType = {
	hmtAuditIn: 16,
	hmtAuditOut: 17,
	hmtEventDebug: 14,
	hmtEventLog: 12,
	hmtEventTransaction: 22,
}

var appName: string = "Ababil";
var client: net.Socket | null = null;

/* Event Level */
export const EventLevel = {
	elInformation: 0,
	elWarning: 1,
	elHigh: 2,
	elCritical: 3
}

/* Header Type */
export const HeaderType = {
	ht2B: 8
}

/* Message Format */
export const MessageFormat = {
	mfXml: 0x0100
}

export function setAppName(name: string) {
	appName = name;
}

export function connect(host: string, callback: any) {
	client = net.connect({ host: host, port: 2743 }, () => {
		console.log("EventLogger Connected");
	});

	client.on("connect", callback);
	client.on("close", clientClose);
	client.on("error", clientError);
	client.on("drain", clientCleanup);
	client.on("end", clientCleanup);
}

function clientError(error: any) {
	console.log("EventLogger Error", error);
}

function clientClose() {
	console.log("EventLogger Disconnect");
	client = null;
}

function clientCleanup() {
	console.log("EventLogger End");
	client?.destroy();
	client = null;
	resolve();
}

function send(data: any) {
	if (client) {
		client.write(data);
	}
}

function singlesend(data: any) {
	var client = net.connect({ host: '127.0.0.1', port: 2743 }, () => {
		client.write(data, () => {
			client.destroy();
			resolve();
		});
	});
}

function createIPC(appName: string, sender: string, messageType: number, hi: number, lo: number, info: Buffer) {
	//	let messageType = messageType;
	let failCode = 1;
	let senderType = 0;
	//	let sender = sender;
	let destinationType = 0;
	let destination = ""
	let stringData = info;
	let longwordData = 0;
	let longwordExtra = 0;
	if (hi <= 0xFFFF) {
		longwordData = (hi << 16) + lo;
		longwordExtra = 0;
	} else {
		longwordData = lo;
		longwordExtra = hi;
	}
	//	let appName = appName;
	let dateData = 0;

	/* calculate length */
	let l1 = (sender == null) ? 0 : sender.length;
	let l2 = (destination == null) ? 0 : destination.length;
	let l3 = (stringData == null) ? 0 : stringData.length;
	let l4 = (appName == null) ? 0 : appName.length;

	let len = 2 + 3 + l1 + 3 + l2 + 3 + l3 + 8 + 8 + 2 + l4 + 8;
	let data = Buffer.alloc(len + 2); // add 2 bytes for header length
	let offset = 0;

	/* header length (htT2) */
	data.writeInt16BE(len, offset); offset = offset + 2;

	data.writeInt8(messageType, offset++);
	data.writeInt8(failCode, offset++);

	/* sender */
	data.writeInt8(senderType, offset++);
	data.writeInt16BE(l1, offset); offset = offset + 2;
	if (l1 > 0) {
		data.write(sender, offset); offset = offset + l1;
	}

	/* destination */
	data.writeInt8(destinationType, offset++);
	data.writeInt16BE(l2, offset); offset = offset + 2;
	if (l2 > 0) {
		data.write(destination, offset); offset = offset + l2;
	}

	/* stringdata */
	data.writeInt8((l3 >> 16), offset++);
	data.writeInt16BE(l3, offset); offset = offset + 2;
	if (l3 > 0) {
		stringData.copy(data, offset); offset = offset + l3;
	}

	/* LongwordData */
	data.write(longwordData.toString(16).toUpperCase(), offset); offset = offset + 8;

	/* DateData */
	// Date dt = new Date();
	// dateData = dt.getTime();
	// BigDecimal delphi_dt = new BigDecimal(dateData);
	// delphi_dt = delphi_dt.divide(new BigDecimal(86400000), 8, RoundingMode.HALF_UP);
	// delphi_dt = delphi_dt.add(udt_gmt);
	// data.putDouble(delphi_dt.doubleValue());
	data.writeDoubleLE(0, offset); offset = offset + 8;

	/* AppName */
	data.writeInt16BE(l4, offset); offset = offset + 2;
	if (l4 > 0) {
		data.write(appName, offset); offset = offset + l4;
	}

	/* LongwordExtra */
	data.write(longwordExtra.toString(16).toUpperCase(), offset);

	return data;
}

export function log(entity: string, eventID: number, level: number, sLog: string) {
	let data = createIPC(appName, entity, EnumIMHeaderMsgType.hmtEventLog, eventID, level, Buffer.from(sLog));
	send(data);
}

export function audit(entity: string, isOut: boolean, header: number, format: number, sLog: Buffer) {
	let data = createIPC(appName, entity, isOut ? EnumIMHeaderMsgType.hmtAuditOut : EnumIMHeaderMsgType.hmtAuditIn, header, format, sLog);
	send(data);
}

export function debug(entity: string, sLog: string) {
	let data = createIPC(appName, entity, EnumIMHeaderMsgType.hmtEventDebug, 0, 0, Buffer.from(sLog));
	send(data);
}

export function trx(entity: string, info: string, isUpdate: boolean) {
	let data = createIPC(appName, entity, EnumIMHeaderMsgType.hmtEventTransaction, 0, (isUpdate ? 2 : 1), Buffer.from(info));
	send(data);
}

export function err(entity: string, eventID: number, level: number, error: any) {
	let data = createIPC(appName, entity, EnumIMHeaderMsgType.hmtEventLog, eventID, level, Buffer.from(error.toString()));
	send(data);
}

