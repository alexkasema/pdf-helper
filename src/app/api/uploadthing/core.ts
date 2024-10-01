import { db } from "@/db";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { createUploadthing, type FileRouter } from "uploadthing/next";

import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";

import { UploadThingError } from "uploadthing/server";
import { pinecone } from "@/lib/pinecone";

const f = createUploadthing();

// FileRouter for your app, can contain multiple FileRoutes
export const ourFileRouter = {
  pdfUploader: f({ pdf: { maxFileSize: "4MB" } })
    .middleware(async ({ req }) => {
      const { getUser } = getKindeServerSession();
      const user = await getUser();

      if (!user || !user.id) throw new Error("Unauthorized");
      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const createdFile = await db.file.create({
        data: {
          key: file.key,
          name: file.name,
          userId: metadata.userId,
          url: file.url,
          uploadStatus: "PROCESSING",
        },
      });

      try {
        //! Get the file, index the pdf in memory
        const response = await fetch(`${file.url}`);
        console.log("response: ", response.status);

        //! we need the pdf as a blob object in order to index it.
        const blob = await response.blob();
        console.log("blob: ", blob);

        //! load pdf file into memory
        const loader = new PDFLoader(blob);

        //! extract the page level text of the pdf 'page content'
        //! each element in the array represents a page in the pdf
        const pageLevelDocs = await loader.load();

        //! we can use this to check if you are on the free or pro plan
        const pagesAmt = pageLevelDocs.length;

        //! vectorize and index entire document
        const pineconeIndex = pinecone.index("pdf-helper");
        console.log({ pineconeIndex });

        //! generate vectors from the text
        const embeddings = new OpenAIEmbeddings({
          apiKey: process.env.OPENAI_API_KEY,
          onFailedAttempt: (attempt) => {
            console.log("Failed attempt: ", attempt.error.message);
          },
        });

        //!testing the embeddings
        // const res = await embeddings.embedQuery(
        //   "What would be a good company name for a company that makes colorful socks?"
        // );
        // console.log({ res });

        await PineconeStore.fromDocuments(pageLevelDocs, embeddings, {
          pineconeIndex,
          namespace: createdFile.id,
        });

        await db.file.update({
          data: {
            uploadStatus: "SUCCESS",
          },
          where: {
            id: createdFile.id,
          },
        });
      } catch (error) {
        await db.file.update({
          data: {
            uploadStatus: "FAILED",
          },
          where: {
            id: createdFile.id,
          },
        });
      }
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
