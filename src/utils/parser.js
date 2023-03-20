const domParser = new DOMParser();

export default (responseData) => {
  const xmlDocument = domParser.parseFromString(responseData, 'text/xml');
  const parserErrorCheck = xmlDocument.querySelector('parsererror');
  if (parserErrorCheck) {
    const error = new Error(parserErrorCheck.textContent);
    error.isParsingError = true;
    throw error;
  }

  const channel = xmlDocument.querySelector('channel');
  const channelTitle = xmlDocument.querySelector('channel title').textContent;
  const channelDescription = xmlDocument.querySelector('channel description').textContent;

  const itemElements = channel.getElementsByTagName('item');
  const items = [...itemElements].map((item) => {
    const title = item.querySelector('title').textContent;
    const description = item.querySelector('description').textContent;
    const link = item.querySelector('channel link').textContent;
    return {
      title,
      description,
      link,
    };
  });

  const parsedData = {
    title: channelTitle,
    description: channelDescription,
    items,
  };
  return (parsedData);
};
