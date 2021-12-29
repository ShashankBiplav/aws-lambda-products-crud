import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import AWS from "aws-sdk";
import { v4 } from "uuid";
import * as yup from "yup";

const docClient = new AWS.DynamoDB.DocumentClient();

const tableName = "ProductsTable";

const headers = {
  "content-type": "application/json",
};

const schema = yup.object().shape({
  name: yup.string().required(),
  category: yup.string().required(),
  description: yup.string().required(),
  price: yup.number().required(),
  isActive: yup.bool().required(),
});

class HttpError extends Error {
  constructor(public statusCode: number, body: Record<string, unknown> = {}) {
    super(JSON.stringify(body));
  }
}

//helper: fetching a product using its productID
const fetchProductById = async (id: string) => {
  console.log(id);
  console.log(typeof id);
  const output = await docClient
    .get({
      TableName: tableName,
      Key: {
        productID: id,
      },
    })
    .promise();
  console.log(output.Item);

  if (!output.Item) {
    return new HttpError(404, { error: "not found" });
  }

  return output.Item;
};

//error handler: includes : validation error + Syntax error + HttpError handling
const errorHandler = (errorObject: unknown) => {
  if (errorObject instanceof yup.ValidationError) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        errors: errorObject.errors,
      }),
    };
  }

  if (errorObject instanceof SyntaxError) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: `invalid request body format : "${errorObject.message}"` }),
    };
  }

  if (errorObject instanceof HttpError) {
    return {
      statusCode: errorObject.statusCode,
      headers,
      body: errorObject.message,
    };
  }

  throw errorObject;
};

//get a single product using its productID
export const getProduct = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const product = await fetchProductById(event.pathParameters?.productID as string);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(product),
    };
  } catch (err) {
    return errorHandler(err);
  }
};

//Create a new Product
export const createProduct = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const reqBody = JSON.parse(event.body as string);

  await schema.validate(reqBody, { abortEarly: false });

  const product = {
    ...reqBody,
    productID: v4(),
    category: "electronics",
  };
  await docClient
    .put({
      TableName: tableName,
      Item: product,
    })
    .promise();
  return {
    statusCode: 201,
    headers,
    body: JSON.stringify({
      message: "New Product Added!",
      product,
    }),
  };
};

//update a product
export const updateProduct = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const id = event.pathParameters?.id as string;

    await fetchProductById(id);

    const reqBody = JSON.parse(event.body as string);

    await schema.validate(reqBody, { abortEarly: false });

    const product = {
      ...reqBody,
      productID: id,
    };

    await docClient
      .put({
        TableName: tableName,
        Item: product,
      })
      .promise();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(product),
    };
  } catch (e) {
    return errorHandler(e);
  }
};

//delete a product
export const deleteProduct = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const id = event.pathParameters?.id as string;

    await fetchProductById(id);

    await docClient
      .delete({
        TableName: tableName,
        Key: {
          productID: id,
        },
      })
      .promise();

    return {
      statusCode: 204,
      headers,
      body: "",
    };
  } catch (e) {
    return errorHandler(e);
  }
};

//list all products
export const listAllProducts = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const output = await docClient
    .scan({
      TableName: tableName,
    })
    .promise();

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(output.Items),
  };
};
