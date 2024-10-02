import { trpc } from "@/app/_trpc/client";
import { INFINITE_QUERY_LIMIT } from "@/config/infinite-query";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { createContext, ReactNode, useRef, useState } from "react";

type StreamResponse = {
  addMessage: () => void;
  message: string;
  handleInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  isLoading: boolean;
};

export const ChatContext = createContext<StreamResponse>({
  addMessage: () => {},
  message: "",
  handleInputChange: () => {},
  isLoading: false,
});

interface Props {
  fileId: string;
  children: ReactNode;
}

//! what allows us to wrap our components
//! responsible for all the logic in sending and receiving messages
export const ChatContextProvider = ({ fileId, children }: Props) => {
  const [message, setMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { toast } = useToast();

  //! using this we can create the optimistic updates
  const utils = trpc.useUtils();

  //! so that we dont rerender
  const backupMessage = useRef("");

  //! we are not using trpc because we want to stream back a response from the api to the client side/server side
  const { mutate: sendMessage } = useMutation({
    mutationFn: async ({ message }: { message: string }) => {
      const response = await fetch("/api/message", {
        method: "POST",
        body: JSON.stringify({
          fileId,
          message,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      return response.body;
    },
    onMutate: async ({ message }) => {
      //! this will get called as soon as we send the message
      //! where the optimistic update should happen

      backupMessage.current = message;
      setMessage("");

      //! step 1: cancel any outgoing messages so that they dont overide the optimistic update
      await utils.getFileMessages.cancel();

      //! step 2: snapshot the previous message we had
      const previousMessages = utils.getFileMessages.getInfiniteData();

      //! step 3: optimistically insert the new message into the messages window
      utils.getFileMessages.setInfiniteData(
        {
          fileId,
          limit: INFINITE_QUERY_LIMIT,
        },
        (old) => {
          if (!old) {
            return {
              pages: [],
              pageParams: [],
            };
          }

          //! step1: clone the old pages
          let newPages = [...old.pages];

          //! step2: get the latest messages, the last 10 messages and get the one at index 0
          let latestPage = newPages[0]!;

          latestPage.messages = [
            {
              createdAt: new Date().toISOString(),
              id: crypto.randomUUID(),
              text: message,
              isUserMessage: true,
            },
            ...latestPage.messages,
          ];

          newPages[0] = latestPage;

          return {
            ...old,
            pages: newPages,
          };
        }
      );

      //! setting the loading to true after we have inserted the message to the page
      setIsLoading(true);

      return {
        previousMessages:
          previousMessages?.pages.flatMap((page) => page.messages) ?? [],
      };
    },
    onSuccess: async (stream) => {
      //! we get the response back from the api as a stream
      setIsLoading(false);

      if (!stream) {
        return toast({
          title: "There was a problem sending this message",
          description: "Please refresh this page and try again",
          variant: "destructive",
        });
      }

      //! reading the context of the stream
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let done = false;

      // accumulated response
      let accResponse = "";

      //! read the content of the stream that we get back from the api in real time
      while (!done) {
        //! read the stream
        const { value, done: doneReading } = await reader.read();
        done = doneReading;

        //! to get the string content of this stream
        const chunkValue = decoder.decode(value);

        accResponse += chunkValue;

        //! append chunk to the actual message being displayed(the AI response body)
        utils.getFileMessages.setInfiniteData(
          { fileId, limit: INFINITE_QUERY_LIMIT },
          (old) => {
            if (!old) return { pages: [], pageParams: [] };

            //! check for each chunk of message we add, if there is a message already from the ai.
            //! if there is,  we are not going to create another one but instead we will add to it.
            let isAiResponseCreated = old.pages.some((page) =>
              page.messages.some((message) => message.id === "ai-response")
            );

            let updatedPages = old.pages.map((page) => {
              if (page === old.pages[0]) {
                let updatedMessages;

                //! if AI response is not yet created we create it once
                if (!isAiResponseCreated) {
                  updatedMessages = [
                    {
                      createdAt: new Date().toISOString(),
                      id: "ai-response",
                      text: accResponse,
                      isUserMessage: false,
                    },
                    ...page.messages,
                  ];
                } else {
                  //! if there is already an AI response, we just add to the existing response
                  updatedMessages = page.messages.map((message) => {
                    if (message.id === "ai-response") {
                      return {
                        ...message,
                        text: accResponse,
                      };
                    }
                    return message;
                  });
                }

                return {
                  ...page,
                  messages: updatedMessages,
                };
              }

              return page;
            });

            return { ...old, pages: updatedPages };
          }
        );
      }
    },
    onError: (_, __, context) => {
      setMessage(backupMessage.current);
      utils.getFileMessages.setData(
        { fileId },
        { messages: context?.previousMessages ?? [] }
      );
    },
    onSettled: async () => {
      //! if we are either successful or not.
      setIsLoading(false);

      //! if everything was successful or not, we refresh the entire data.
      //! we get the most accurate data after the message has been sent
      await utils.getFileMessages.invalidate({ fileId });
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };

  //! what we will use to send a message to api/message/ endpoint
  const addMessage = () => sendMessage({ message });

  return (
    <ChatContext.Provider
      value={{
        addMessage,
        message,
        handleInputChange,
        isLoading,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
