import { Hocuspocus } from "@hocuspocus/server";

const server = new Hocuspocus({
  port: 8080,

  async onConnect(data: any) {
    console.log(
      `User ${data.socketId} connected to document "${data.documentName}"`
    );
  },

  async onDisconnect(data: any) {
    console.log(
      `User ${data.socketId} disconnected from document "${data.documentName}"`
    );
  },

  async onCreateDocument(data: any) {
    console.log(`Document "${data.documentName}" created`);
  },

  async onLoadDocument(data: any) {
    console.log(`Document "${data.documentName}" loaded`);
  },

  async onChange(data: any) {
    console.log(`Document "${data.documentName}" changed`);
  },
});

console.log("🚀 Teleprompter collaboration server starting on port 3001...");

server.listen().then(() => {
  console.log("✅ Server is running on ws://localhost:8080");
});
