interface PageProps {
  fileId: string;
}

const ChatWrapper = ({ fileId }: PageProps) => {
  return <div>{fileId}</div>;
};

export default ChatWrapper;
