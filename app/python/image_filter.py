from PIL import Image, ImageOps
import numpy as np
# from pytesseract import *
import os
# import tesseract
#
#
# api = tesseract.TessBaseAPI()
# api.SetVariable("tessedit_char_whitelist", "0123456789")
# api.Init('.','eng',tesseract.OEM_DEFAULT)
# api.SetPageSegMode(tesseract.PSM_AUTO)

BLACK = 0
WHITE = 255

def get_area_width(img):
    n_digits = 0
    n_cols = 0
    s_col = 0
    max_len = 0
    digits_list = []
    for cols in img.T:
        white_col = True
        for pixel in cols:
            bone = 0
            if bone != 0:
                bone -= 1
                # pixel = 0
                if bone == 0:
                    continue
            elif pixel != 255:
                white_col = False
                # bone = 2
                if s_col is 0:
                    s_col = n_cols
                continue
        if white_col and s_col != 0:
            n_digits += 1
            cur_len = n_cols - s_col
            digit = img[:13, s_col:n_cols]
            # print(digit.shape)
            #path = 'test_samples/' + str(s_col) + '.bmp'
            img_new = Image.fromarray(digit).convert('L')
            img_new = img_new.resize((10,13), Image.ANTIALIAS)
            img_arr = np.array(img_new).astype(np.float32)
            # print(img_arr.shape)
            img_arr = np.multiply(img_arr, 1.0 / 255.0)
            img_arr = img_arr.reshape(10, 13, 1)
            digits_list.append(img_arr)
            s_col = 0
            if 9 < cur_len:
               return [], False
            # print(cur_len)
            if max_len < cur_len:
                max_len = cur_len
        n_cols += 1
    # Image.fromarray(img).show()
    return digits_list, True

def is_boned_pixel(img, x, y):
    neighbors = np.zeros((3,3))
    num_of_black_pixels = 0
    for i in range(-1, 2):
        for j in range(-1, 2):
            if (i is 0 and j is 0) or x + i > len(img) or x + i < 0 or y + j > len(img[0]) or y + j < 0:
                neighbors[i+1][j+1] = WHITE
                continue
            if img[x+i][y+j] == BLACK:
                num_of_black_pixels += 1
            else:
                neighbors[i+1][j+1] = WHITE
    is_connect_pixel = (neighbors[0][1] == neighbors[2][1] and neighbors[1][0] is not BLACK and neighbors[1][2] is not BLACK) \
                       or (neighbors[1][0] == neighbors[1][2] and neighbors[0][1] is not BLACK and neighbors[2][1] is not BLACK)
    if x == 0 and y == 7:
        print(num_of_black_pixels, is_connect_pixel)
        print(neighbors)
    return num_of_black_pixels > 4 or is_connect_pixel or num_of_black_pixels == 1

def is_edge_pixel(img, x, y):
    for i in range(-1, 2):
        for j in range(-1, 2):
            if abs(i + j) != 1 or x + i > len(img) or x + i < 0 or y + j > len(img[0]) or y + j < 0:
                continue
            if img[x + i][y + j] == WHITE:
                return True
    return False

def corrode(img):
    height = len(img_arr)
    width = len(img_arr[0])
    img_cp = np.zeros((height, width))
    img_cp.fill(255)
    for (x,y), value in np.ndenumerate(img):
        if value == BLACK and is_boned_pixel(img, x, y):
            # print(x,y)
            img_cp[x][y] = BLACK
            #print('haha')
    return img_cp

def text_to_strings(str):
    rep = {
        'O': '0',
        'R': '2',
        'D': '0',

    }
    str = str.upper()
    for r in rep:
        str = str.replace(r, rep[r])
    return str

def training_data_loader(folder_path):
    i = 1
    # cur_label = 0
    os.chdir(folder_path)
    list_of_samples = []
    list_of_labels = []
    #counter = 0
    for filename in os.listdir():
        #counter += 1
        cur_label = int(filename[:1])
        img = Image.open(filename).convert('L')
        img = img.resize((10, 13))
        img_arr = np.array(img)
        img_arr = np.multiply(img_arr, 1.0 / 255.0)
        img_arr = img_arr.reshape((10, 13, 1))
        label = np.zeros(10)
        label[cur_label] = 1
        list_of_samples.append(img_arr)
        list_of_labels.append(label)
        # i += 1
        # if i > number_of_each_sample:
            # i = 1
            # cur_label += 1
    ret_samples = np.array(list_of_samples)
    ret_labels = np.array(list_of_labels)
    #print(counter)
    #print(ret_labels.shape)
    os.chdir('..')
    return (ret_samples, ret_labels)

def picture_loader(file_path):
    img = Image.open(file_path).convert('L')
    img_arr = np.array(img).astype(np.float32)
    for (x, y), value in np.ndenumerate(img_arr):
        if value < 100:
            img_arr[x][y] = 0
        else:
            img_arr[x][y] = 255
    digits_list, identify = get_area_width(img_arr)
    #print(digits_list)
    #print(identify)
    # if not identify:
    #     return "alahuakeba"
    return (digits_list, identify)

# def read_from_buffer(img_buffer):


#picture_loader('images/4.jpg')
# img = Image.open('images/49.jpg').convert('L')
# X, Y = training_data_loader('samples', 10)
# print(X.shape)
# # print(Y)
# # img.show()
# # img = img.resize((28, 28), Image.ANTIALIAS)
#
# img_arr = np.array(img).astype(np.float32)
# # print(img_new.shape)
#
# for (x,y), value in np.ndenumerate(img_arr):
#     if value < 100:
#         img_arr[x][y] = 0
#     else:
#         img_arr[x][y] = 255
#
# img_new = corrode(img_arr)
#
# print(get_area_width(img_arr))
#
# img_new = Image.fromarray(img_new).convert('RGB')
# #img_new.show()
# img_ori = Image.fromarray(img_arr).convert('RGB')
# guess = image_to_string(img_ori)
# guess_m = image_to_string(img_new)
# print("guess:", guess)
# print("modified guess:", guess_m)
